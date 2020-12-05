/* eslint-disable require-jsdoc */

const Konva = window.Konva;
const width = window.innerWidth;
const height = window.innerHeight;


const ZOOM_SCALES_BY = 1.05;
const MAX_ROWS = 250;
const MAX_COLS = 250;
const GRID_STROKE_COLOR = '#4d2d52dd';
const ROW_FILL_COLOR = 'rgba(200, 200, 200, .05)';
const ROW_STROKE_COLOR = '#f49d376a';
const SELECTED_ROW_FILL_COLOR = '#fada5e4a';
const SELECTED_ROW_STROKE_COLOR = '#f49d37dd';
const COL_STROKE_COLOR = '#3c6c82aa';
const SELECTED_COL_STROKE_COLOR = '#083d77dd';

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
  constructor(layer, startPos, endPos, numRows, numCols) {
    this.startPos = startPos;
    this.numRows = numRows || 5;
    this.numCols = numCols || 5;
    this.rows = [];
    this.cols = [];
    this.selectedRow = 0;
    this.selectedColumn = 1;

    this.boundingRect = new Konva.Rect({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      stroke: GRID_STROKE_COLOR,
      strokeWidth: 2,
      dash: [3, 3],
      draggable: false
    });

    this.group = new Konva.Group({
      x: startPos.x,
      y: startPos.y,
      draggable: true,
      name: 'element'
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
    const x = Math.min(this.startPos.x, endPos.x);
    const y = Math.min(this.startPos.y, endPos.y);
    const w = Math.abs(endPos.x - this.startPos.x);
    const h = Math.abs(endPos.y - this.startPos.y);
    this.group.x(x);
    this.group.y(y);
    this.boundingRect.width(w);
    this.boundingRect.height(h);
    this.boundingRect.visible(true);
    this.updateRowsCols();
  }

  createRowsCols() {
    if (this.numRows > this.rows.length) {
      // Add rows.
      for (let i = this.rows.length; i < this.numRows; i++) {
        const rowDims = this.rowDims(i);
        const rect = new Konva.Rect({
          x: rowDims.x,
          y: rowDims.y,
          width: rowDims.w,
          height: rowDims.h,
          fill: ROW_FILL_COLOR,
          stroke: ROW_STROKE_COLOR,
          strokeWidth: 1,
          draggable: false
        });
        this.group.add(rect);
        this.rows.push(rect);
      }
    } else if (this.numRows < this.rows.length) {
      // Delete rows.
      const deletedRows = this.rows.splice(this.numRows - this.rows.length);
      deletedRows.forEach(row => row.destroy());
      if (this.selectedRow >= this.rows.length) this.cursorDown();
    }

    if (this.numCols > this.cols.length) {
      // Add cols.
      for (let j = this.cols.length; j < this.numCols + 1; j++) {
        const colDims = this.colDims(j);
        const line = new Konva.Line({
          x: colDims.x,
          y: colDims.y,
          points: colDims.points,
          stroke: COL_STROKE_COLOR,
          strokeWidth: 1,
          draggable: false,
          tension: 1
        });
        this.group.add(line);
        this.cols.push(line);
      }
    } else if (this.numCols < this.cols.length) {
      // Delete cols.
      const deletedCols = this.cols.splice(this.numCols - this.cols.length);
      deletedCols.forEach(col => col.destroy());
      if (this.selectedCol >= this.cols.length) this.cursorRight();
    }
    this.updateRowsCols();
  }

  updateRowsCols() {
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      if (i == this.selectedRow) {
        row.name('selected');
        row.fill(SELECTED_ROW_FILL_COLOR);
        row.stroke(SELECTED_ROW_STROKE_COLOR);
        row.strokeWidth(2);
      } else {
        row.removeName('selected');
        row.fill(ROW_FILL_COLOR);
        row.stroke(ROW_STROKE_COLOR);
        row.strokeWidth(1);
      }
      const rowDims = this.rowDims(i);
      row.y(rowDims.y);
      row.width(rowDims.w);
      row.height(rowDims.h);
    }
    for (let j = 0; j < this.cols.length; j++) {
      const column = this.cols[j];
      if (j == this.selectedColumn) {
        column.name('selected');
        column.stroke(SELECTED_COL_STROKE_COLOR);
        column.strokeWidth(3);
      } else {
        column.removeName('selected');
        column.stroke(COL_STROKE_COLOR);
        column.strokeWidth(1);
      }
      const colDims = this.colDims(j);
      column.x(colDims.x);
      column.width(colDims.w);
      column.points(colDims.points);
    }
  }

  rowDims(i) {
    const rowHeight = this.boundingRect.height() / this.numRows;
    return {
      h: rowHeight,
      w: this.boundingRect.width(),
      x: 0,
      y: this.boundingRect.height() - (i + 1) * rowHeight
    };
  }

  colDims(j) {
    const colWidth = this.boundingRect.width() / this.numCols;
    const x = this.boundingRect.width() - j * colWidth;
    return {
      x: x,
      y: 0,
      points: [0, -10, 0, this.boundingRect.height() + 10]
    };
  }

  deselect() {
    this.group.getChildren(n => !n.hasName('selected')).stroke(
      '#aaaaaaaa');
    this.boundingRect.strokeWidth(2);
    return this;
  }

  select() {
    this.boundingRect.stroke(GRID_STROKE_COLOR);
    this.boundingRect.strokeWidth(4);
    this.boundingRect.dash([0, 0]);
    this.updateRowsCols();
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

  cursorLeft() {
    this.selectedColumn = Math.min(this.selectedColumn + 1, this.numCols);
    this.updateRowsCols();
  }

  cursorRight() {
    this.selectedColumn = Math.max(this.selectedColumn - 1, 0);
    this.updateRowsCols();
  }

  cursorDown() {
    this.selectedRow = Math.max(this.selectedRow - 1, 0);
    this.updateRowsCols();
  }

  addRows(n) {
    this.numRows = Math.min(this.numRows + n, MAX_ROWS);
    this.createRowsCols();
  }

  removeRows(n) {
    this.numRows = Math.max(this.numRows - n, 1);
    this.createRowsCols();
  }

  setRows(n) {
    this.numRows = Math.min(Math.max(n, 0), MAX_ROWS);
    this.createRowsCols();
  }

  addCols(n) {
    this.numCols = Math.min(this.numCols + n, MAX_ROWS);
    this.createRowsCols();
  }

  removeCols(n) {
    this.numCols = Math.max(this.numCols - n, 1);
    this.createRowsCols();
  }

  setCols(n) {
    this.numCols = Math.min(Math.max(n, 0), MAX_COLS);
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
  LOCKED: 4,
  UNLOCKED: 5
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
    this.lockState = States.UNLOCKED;
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

    // Help text.
    const complexText = new Konva.Text({
      x: width / 2,
      y: height / 2,
      text: `Instructions:\n\n1. Copy a pattern image from some source\n
2. Paste image (Ctrl+V) onto this canvas\n
3. Draw a grid over it using the controls above\n
4. Refresh the page to start over`,
      fontSize: 16,
      fontFamily: 'Roboto',
      fill: '#555',
      width: 400,
      padding: 20,
      align: 'center',
    });
    complexText.offsetX(complexText.width() / 2);
    complexText.offsetY(complexText.height() / 2);

    const rect = new Konva.Rect({
      x: width / 2 - 200,
      y: height / 2 - complexText.height() / 2,
      stroke: '#fada5e',
      strokeWidth: 3,
      fill: '#fafafa',
      width: 400,
      height: complexText.height(),
      shadowColor: '#4d2d52',
      shadowBlur: 10,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      shadowOpacity: 0.2,
      cornerRadius: 5,
    });

    // Add the shapes to the layer
    this.layer.add(rect);
    this.layer.add(complexText);

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
    this.controls.querySelectorAll('form').forEach((form) => {
      form.addEventListener('submit', (e) => {
        this.updateGridFromInputs(this.selectedGrid);
        e.preventDefault();
      });
    });
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
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorDown();
        break;
      case 'Up': // IE/Edge specific value
      case 'ArrowUp':
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorUp();
        break;
      case 'Left': // IE/Edge specific value
      case 'ArrowLeft':
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorLeft();
        break;
      case 'Right': // IE/Edge specific value
      case 'ArrowRight':
        if (!this.selectedGrid) break;
        this.selectedGrid.cursorRight();
        break;
      case 'Enter':
        if (this.gridState == States.AWAITING_GRID_END) {
          this.clickAction();
        }
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
    switch (this.gridState) {
      case States.DESELECTED: {
        if (grid) {
          this.selectGrid(grid);
          this.gridState = States.SELECTED;
        }
        break;
      }
      case States.SELECTED: {
        if (grid) {
          this.selectGrid(grid);
          this.gridState = States.SELECTED;
        } else {
          this.deselectGrid();
          this.gridState = States.DESELECTED;
        }
        break;
      }
      case States.AWAITING_GRID_START: {
        const mousePos = getRelativePointerPosition(this.stage);
        const draggable = this.lockState == States.UNLOCKED;
        const numRows = parseInt(this.controls.querySelector('.num-rows')
          .value) || 5;
        const numCols = parseInt(this.controls.querySelector('.num-cols')
          .value) || 5;
        this.previewGrid = new Grid(this.layer, mousePos, null, numRows,
          numCols);
        this.previewGrid.getGroup().draggable(draggable);

        // Add handler for mouse movement.
        this.stage.on('mousemove', () => this.mouseMoveHandler());
        this.gridState = States.AWAITING_GRID_END;
        break;
      }
      case States.AWAITING_GRID_END: {
        this.previewGrid
          .getGroup()
          .on('mousedown tap', this.makeGridClickHandler(this
            .previewGrid));
        this.selectGrid(this.previewGrid);
        this.cancelPreview( /*destroy=*/ false);

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

  toggleLockAction(e) {
    switch (this.lockState) {
      case States.UNLOCKED: {
        this.stage.find('.element').forEach(element => {
          element.draggable(false);
        });
        this.controls.querySelector('.lock>span').innerText = 'lock';
        this.lockState = States.LOCKED;
        break;
      }
      case States.LOCKED: {
        this.stage.find('.element').forEach(element => {
          element.draggable(true);
        });
        this.controls.querySelector('.lock>span').innerText = 'lock_open';
        this.lockState = States.UNLOCKED;
        break;
      }
    }
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
      case 'lock': {
        button.addEventListener('click', () => {
          this.toggleLockAction();
        });
        break;
      }
      default: {
        button.addEventListener('click', () => {
          if (!this.selectedGrid) return;
          switch (action) {
            case 'add-row': {
              this.selectedGrid.addRows(1);
              break;
            }
            case 'sub-row': {
              this.selectedGrid.removeRows(1);
              break;
            }
            case 'add-col': {
              console.log('adding col');
              this.selectedGrid.addCols(1);
              break;
            }
            case 'sub-col': {
              console.log('subbing col');
              this.selectedGrid.removeCols(1);
              break;
            }
          }

          this.updateInputsFromGrid(this.selectedGrid);
          this.stage.batchDraw();
        });
        break;
      }
    }
  }

  selectGrid(grid) {
    if (grid !== this.selectedGrid) {
      this.deselectGrid();
    }
    if (!grid) return;
    this.selectedGrid = grid.select();
    this.updateInputsFromGrid(grid);
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
    this.previewGrid = null;
  }

  updateInputsFromGrid(grid) {
    if (!grid) return;
    this.controls.querySelector('.num-rows').value = grid.numRows;
    this.controls.querySelector('.num-cols').value = grid.numCols;
  }

  updateGridFromInputs(grid) {
    if (!grid) return;
    const numRows = parseInt(this.controls.querySelector('.num-rows')
      .value);
    const numCols = parseInt(this.controls.querySelector('.num-cols')
      .value);
    grid.setRows(numRows);
    grid.setCols(numCols);
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
      const padding = 60;
      const kImg = new Konva.Image({
        x: (width - imgWidth) / 2 + padding,
        y: (height - imgHeight) / 2 + padding,
        image: img,
        width: imgWidth - padding - 10,
        height: imgHeight - padding - 10,
        draggable: this.lockState == States.UNLOCKED,
        name: 'element'
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
  const app = new App('#container', '#controls', width, height);
};
