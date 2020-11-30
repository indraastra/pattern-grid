/* eslint-disable require-jsdoc */

const Konva = window.Konva;
const width = window.innerWidth;
const height = window.innerHeight;
const ZOOM_SCALES_BY = 1.05;
const ROW_FILL_COLOR = 'rgba(40, 40, 40, .1)';
const ROW_STROKE_COLOR = 'rgba(0, 0, 0, .1)';
const SELECTED_ROW_FILL_COLOR = 'rgba(150, 20, 20, 0.1)';
const SELECTED_ROW_STROKE_COLOR = 'rgba(150, 20, 20, 0.5)';

// From https://ourcodeworld.com/articles/read/491/how-to-retrieve-images-from-the-clipboard-with-javascript-in-the-browser:
async function retrieveImageFromClipboardAsBlob(pasteEvent) {
  if (pasteEvent.clipboardData == false) {
    return undefined;
  };

  const items = pasteEvent.clipboardData.items;
  if (items === undefined) {
    return undefined;
  };

  for (let i = 0; i < items.length; i++) {
    // Skip content if not image
    if (items[i].type.indexOf('image') == -1) continue;
    // Retrieve image on clipboard as blob
    const blob = items[i].getAsFile();
    return blob;
  }
}

// From https://konvajs.org/docs/sandbox/Relative_Pointer_Position.html#page-title
function getRelativePointerPosition(node) {
  const transform = node.getAbsoluteTransform().copy();
  // to detect relative position we need to invert transform
  transform.invert();

  // get pointer (say mouse or touch) position
  const pos = node.getStage().getPointerPosition();

  // now we can find relative point
  return transform.point(pos);
}

class Grid {
  constructor(layer, startPos, endPos, numRows, numColumns) {
    this.numRows = numRows || 5;
    this.numColumns = numColumns || 5;
    this.rows = [];
    this.columns = [];
    this.selectedRow = 0;
    this.selectedCol = 0;

    this.boundingRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stroke: 'indianred',
      strokeWidth: 2,
      dash: [3, 3],
      draggable: false
    });

    this.group = new Konva.Group({
      x: startPos.x,
      y: startPos.y,
      draggable: true,
    });
    this.group.add(this.boundingRect);
    layer.add(this.group);

    this.createRowsCols();
    if (endPos) this.updateEndPos(endPos);
  }

  getGroup() {
    return this.group;
  }

  updateEndPos(endPos) {
    this.boundingRect.width(endPos.x - this.group.x());
    this.boundingRect.height(endPos.y - this.group.y());
    this.boundingRect.visible(true);

    this.updateRowsCols();
  }

  createRowsCols() {
    const rowWidth = this.boundingRect.width();
    const rowHeight = this.boundingRect.height() / this.numRows;
    if (this.numRows > this.rows.length) {
      for (let i = this.rows.length; i < this.numRows; i++) {
        const rect = new Konva.Rect({
          x: 0,
          y: i * rowHeight,
          width: rowWidth,
          height: rowHeight,
          fill: ROW_FILL_COLOR,
          stroke: ROW_STROKE_COLOR,
          strokeWidth: 2,
          draggable: false
        });
        this.group.add(rect);
        this.rows.push(rect);
      }
    } else if (this.numRows < this.rows.length) {
      const deletedRows = this.rows.splice(this.numRows - this.rows.length);
      deletedRows.forEach(row => row.destroy());
    }
    if (this.numColumns != this.columns.length) {

    }
    this.updateRowsCols();
  }

  updateRowsCols() {
    const rowWidth = this.boundingRect.width();
    const rowHeight = this.boundingRect.height() / this.numRows;
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      if ((this.numRows - i - 1) == this.selectedRow) {
        row.fill(SELECTED_ROW_FILL_COLOR);
        row.stroke(SELECTED_ROW_STROKE_COLOR);
      } else {
        row.fill(ROW_FILL_COLOR);
        row.stroke(ROW_STROKE_COLOR);
      }
      row.y(i * rowHeight);
      row.width(rowWidth);
      row.height(rowHeight);
    }
  }

  deselect() {
    this.boundingRect.stroke('gray');
    this.boundingRect.strokeWidth(1);
    return this;
  }

  select() {
    this.boundingRect.stroke('indianred');
    this.boundingRect.strokeWidth(2);
    return this;
  }

  cursorUp() {
    this.selectedRow = Math.min(this.selectedRow + 1, this.numRows - 1);
    this.updateRowsCols();
  }

  cursorDown() {
    this.selectedRow = Math.max(this.selectedRow - 1, 0);
    this.updateRowsCols();
  }

  addRow() {
    this.numRows += 1;
    this.createRowsCols();
  }

  removeRow() {
    this.numRows = Math.max(this.numRows - 1, 1);
    this.createRowsCols();
  }

  addColumn() {
    this.numColumns += 1;
    this.createRowsCols();
  }

  removeColumn() {
    this.columns = Math.max(this.numColumns - 1, 1);
    this.createRowsCols();
  }

  destroy() {
    this.group.destroy();
  }
}

const States = {
  DESELECTED: 0,
  SELECTED: 1,
  AWAITING_GRID_START: 2,
  AWAITING_GRID_END: 3,
};

class App {
  constructor(containerSel, controlsSel, width, height) {
    this.containerSel = containerSel;
    this.controlsSel = controlsSel;
    this.width = width;
    this.height = height;

    // Initialize UI.
    this.initializeUI();

    // Add event listeners.
    this.registerHandlers();
  }

  initializeUI() {
    // UI state.
    this.gridState = States.DESELECTED;
    this.selectedGrid = null;
    this.previewGrid = null;

    // UI elements.
    this.container = document.querySelector(this.containerSel)
      .parentNode;
    this.controls = document.querySelector(this.controlsSel);

    this.stage = new Konva.Stage({
      container: this.containerSel,
      width: this.width,
      height: this.height,
      draggable: true
    });
    this.layer = new Konva.Layer();
    this.stage.add(this.layer);

    this.resizeWindowHandler();
  }

  registerHandlers() {
    window.addEventListener('paste', (e) => {
      retrieveImageFromClipboardAsBlob(e).then(
        (imgBlob) => this.pasteImageBlobToLayer(imgBlob,
          this.layer));
    }, false);
    window.addEventListener('resize', () => this.resizeWindowHandler());
    document.onkeydown = (e) => this.keyPressHandler(e);
    this.stage.on('wheel', (e) => this.zoomHandler(e));
    this.stage.on('mousedown touchstart', () => this.clickAction());
    this.controls.querySelectorAll('button').forEach((el) => this
      .makeControlClickHandler(el));
  }

  /* Event handlers */
  resizeWindowHandler() {
    const containerWidth = this.container.offsetWidth;
    const scale = containerWidth / this.width;
    this.stage.width(this.width * scale);
    this.stage.height(this.height * scale);
    this.stage.scale({
      x: scale,
      y: scale,
    });
    this.stage.draw();
  }

  zoomHandler(e) {
    e.evt.preventDefault();
    const stage = this.stage;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale =
      e.evt.deltaY > 0 ? oldScale * ZOOM_SCALES_BY : oldScale /
      ZOOM_SCALES_BY;

    stage.scale({
      x: newScale,
      y: newScale,
    });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    stage.batchDraw();
  }

  mouseMoveHandler() {
    const mousePos = getRelativePointerPosition(this.stage);
    this.previewGrid.updateEndPos(mousePos);
    this.stage.batchDraw();
  }

  keyPressHandler(e) {
    switch (e.key) {
      case 'Down': // IE/Edge specific value
      case 'ArrowDown':
        // Do something for 'down arrow' key press.
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorDown();
        break;
      case 'Up': // IE/Edge specific value
      case 'ArrowUp':
        // Do something for 'up arrow' key press.
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorUp();
        break;
      case 'Left': // IE/Edge specific value
      case 'ArrowLeft':
        // Do something for 'left arrow' key press.
        break;
      case 'Right': // IE/Edge specific value
      case 'ArrowRight':
        // Do something for 'right arrow' key press.
        break;
      case 'Enter':
        this.clickAction();
        break;
      case 'Esc': // IE/Edge specific value
      case 'Escape':
        if (this.gridState == States.AWAITING_GRID_END) {
          this.cancelPreview( /*destroy=*/ true);
        }
        break;
      default:
        return; // Quit when this doesn't handle the key event.
    }
    this.stage.batchDraw();
  }

  /* State transitions */
  clickAction(grid) {
    console.log('Canvas click');
    switch (this.gridState) {
      case States.DESELECTED: {
        if (grid) this.selectGrid(grid);
        break;
      }
      case States.SELECTED: {
        this.deselectGrid();
        if (grid) this.selectGrid(grid);
        break;
      }
      case States.AWAITING_GRID_START: {
        console.log('Awaiting start');
        const mousePos = getRelativePointerPosition(this.stage);
        this.previewGrid = new Grid(this.layer, mousePos);

        // Add handler for mouse movement.
        this.stage.on('mousemove', () => this.mouseMoveHandler());
        this.gridState = States.AWAITING_GRID_END;
        break;
      }
      case States.AWAITING_GRID_END: {
        this.cancelPreview( /*destroy=*/ false);

        this.previewGrid
          .getGroup()
          .on('mousedown tap', this.makeGridClickHandler(this.previewGrid));
        this.selectGrid(this.previewGrid);

        this.gridState = States.SELECTED;
        break;
      }
    }

    this.stage.batchDraw();
  }

  drawGridAction(e) {
    switch (this.gridState) {
      case States.SELECTED: {
        this.deselectGrid();
        break;
      }
      case States.AWAITING_GRID_END: {
        this.destroyGrid(this.previewGrid);
        break;
      }
    }
    this.stage.container().style.cursor = 'crosshair';
    this.gridState = States.AWAITING_GRID_START;
  }

  deleteGridAction(e) {
    switch (this.gridState) {
      case States.SELECTED: {
        this.destroyGrid(this.selectedGrid);
        break;
      }
      case States.AWAITING_GRID_END: {
        this.cancelPreview( /*destroy=*/ true);
        break;
      }
    }
    this.gridState = States.DESELECTED;
  }

  /* Helpers */
  makeGridClickHandler(grid) {
    return (e) => {
      e.cancelBubble = true;
      this.clickAction(grid);
      this.stage.batchDraw();
    };
  }

  makeControlClickHandler(button) {
    const action = button.className;
    switch (action) {
      case 'draw-grid': {
        button.addEventListener('click', () => {
          this.drawGridAction();
        });
        break;
      }
      case 'delete-grid': {
        button.addEventListener('click', () => {
          this.deleteGridAction();
        });
        break;
      }
      default: {
        button.addEventListener('click', () => {
          if (!this.selectedGrid) return;
          switch (action) {
            case 'add-row': {
              this.selectedGrid.addRow();
              break;
            }
            case 'sub-row': {
              this.selectedGrid.removeRow();
              break;
            }
          }
          this.stage.batchDraw();
        });
        break;
      }
    }
  }

  selectGrid(grid) {
    if (grid === this.selectedGrid) {
      this.deselectGrid();
    }
    if (!grid) return;
    this.selectedGrid = grid.select();
    this.stage.batchDraw();
  }

  deselectGrid() {
    if (!this.selectedGrid) return;
    this.selectedGrid.deselect();
    this.selectedGrid = null;
    this.stage.batchDraw();
  }

  destroyGrid(grid) {
    if (grid === this.selectedGrid) {
      this.selectedGrid = null;
    } else if (grid === this.previewGrid) {
      this.previewGrid = null;
    }
    if (!grid) return;
    console.log('Destroying grid', grid);
    grid.destroy();
    this.stage.batchDraw();
  }

  cancelPreview(destroy) {
    this.stage.container().style.cursor = 'default';
    this.stage.off('mousemove');
    if (destroy) this.destroyGrid(this.previewGrid);
  }

  pasteImageBlobToLayer(imageBlob, layer) {
    if (!imageBlob) return;
    const img = new Image();
    img.onload = () => {
      const isPortrait = img.height > img.width;
      let imgWidth;
      let imgHeight;
      if (isPortrait) {
        imgHeight = height;
        imgWidth = img.width / img.height * imgHeight;
      } else {
        imgWidth = width;
        imgHeight = img.height / img.width * imgWidth;
      }
      const kImg = new Konva.Image({
        x: (width - imgWidth) / 2 + 10,
        y: (height - imgHeight) / 2 + 10,
        image: img,
        width: imgWidth - 20,
        height: imgHeight - 20,
        draggable: true,
      });

      layer.add(kImg);
      layer.batchDraw();
    };
    // Crossbrowser support for URL
    const URLObj = window.URL || window.webkitURL;
    img.src = URLObj.createObjectURL(imageBlob);
  }
}

window.onload = () => {
  // SETUP
  const app = new App('#container', '#controls', width, height);


  // // ZOOM
  // const scaleBy = 1.05;
  // stage.on('wheel', (e) => {
  //   e.evt.preventDefault();
  //   const oldScale = stage.scaleX();

  //   const pointer = stage.getPointerPosition();

  //   const mousePointTo = {
  //     x: (pointer.x - stage.x()) / oldScale,
  //     y: (pointer.y - stage.y()) / oldScale,
  //   };

  //   const newScale =
  //     e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;

  //   stage.scale({
  //     x: newScale,
  //     y: newScale,
  //   });

  //   const newPos = {
  //     x: pointer.x - mousePointTo.x * newScale,
  //     y: pointer.y - mousePointTo.y * newScale,
  //   };
  //   stage.position(newPos);
  //   stage.batchDraw();
  // });
};
