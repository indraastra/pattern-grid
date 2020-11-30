/* eslint-disable require-jsdoc */
const Konva = window.Konva;

const width = window.innerWidth;
const height = window.innerHeight;

class Grid {
  constructor(boundingRect) {
    this.boundingRect = boundingRect;
    this.rows = 0;
    this.columns = 0;

    this.group = new Konva.Group({
      x: boundingRect.x(),
      y: boundingRect.y(),
      draggable: true,
    });
    this.group.add(boundingRect);

    boundingRect.x(0);
    boundingRect.y(0);
    boundingRect.draggable(false);
  }

  getGroup() {
    return this.group;
  }

  deselect() {
    this.boundingRect.stroke('gray');
    this.boundingRect.strokeWidth(1);
    return this;
  }

  select() {
    console.log('group selected');
    this.boundingRect.stroke('indianred');
    this.boundingRect.strokeWidth(2);
    return this;
  }

  addRow() {

  }

  removeRow() {

  }

  destroy() {
    this.group.destroy();
  }
}

function fitStageIntoParentContainer(stage) {
  const container = document.querySelector('#stage-parent');

  // now we need to fit stage into parent
  const containerWidth = container.offsetWidth;
  // to do this we need to scale the stage
  const scale = containerWidth / width;

  stage.width(width * scale);
  stage.height(height * scale);
  stage.scale({
    x: scale,
    y: scale,
  });
  stage.draw();
}


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

function pasteImageBlobToLayer(imageBlob, layer) {
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

function updatePreviewGrid(stage, grid, endPos) {
  grid.width(endPos.x - grid.x());
  grid.height(endPos.y - grid.y());
  grid.visible(true);
  stage.draw();
}


window.onload = () => {
  // SETUP
  const stage = new Konva.Stage({
    container: 'container',
    width: width,
    height: height,
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  fitStageIntoParentContainer(stage);
  // adapt the stage on any window resize
  window.addEventListener('resize', fitStageIntoParentContainer);
  window.addEventListener('paste', (e) => {
    retrieveImageFromClipboardAsBlob(e).then(
      (imgBlob) => pasteImageBlobToLayer(imgBlob, layer));
  }, false);

  // GRID
  let gridState = 'DESELECTED';
  let selectedGrid = null;
  let previewGrid = null;

  document.querySelector('#draw-grid').addEventListener('click', (e) => {
    if (gridState === 'AWAITING_END') {
      previewGrid.destroy();
    } else if (gridState === 'SELECTED') {
      selectedGrid.deselect();
      selectedGrid = null;
    }
    stage.container().style.cursor = 'crosshair';
    gridState = 'AWAITING_START';
  });

  document.querySelector('#delete-grid').addEventListener('click', (e) => {
    if (gridState === 'SELECTED') {
      console.log('deleting selected grid!');
      selectedGrid.destroy();
      selectedGrid = null;
      gridState = 'DESELECTED';
      stage.draw();
    }
  });

  stage.on('mousedown touchstart', () => {
    if (gridState === 'SELECTED') {
      selectedGrid.deselect();
      selectedGrid = null;
    } else if (gridState === 'AWAITING_START') {
      const mousePos = getRelativePointerPosition(stage);
      previewGrid = new Konva.Rect({
        x: mousePos.x,
        y: mousePos.y,
        width: 0,
        height: 0,
        stroke: 'indianred',
        strokeWidth: 2,
        dash: [3, 3],
      });
      layer.add(previewGrid);

      stage.on('mousemove', () => {
        const mousePos = getRelativePointerPosition(stage);
        const x = mousePos.x;
        const y = mousePos.y;
        updatePreviewGrid(stage, previewGrid, {
          x,
          y,
        });
      });
      gridState = 'AWAITING_END';
    } else if (gridState === 'AWAITING_END') {
      stage.container().style.cursor = 'default';
      stage.off('mousemove');
      gridState = 'SELECTED';

      const thisGrid = new Grid(previewGrid).select();
      selectedGrid = thisGrid;

      selectedGrid.getGroup().on('mousedown tap', (e) => {
        e.cancelBubble = true;
        if (gridState === 'AWAITING_START' || gridState === 'AWAITING_END') {
          return;
        }
        if (selectedGrid === thisGrid) {
          return;
        }
        if (selectedGrid) selectedGrid.deselect();
        selectedGrid = thisGrid.select();
        stage.draw();
      });

      // Move Rect into Grid.
      layer.add(selectedGrid.getGroup());
    }
    stage.draw();
  });

  // ZOOM
  const scaleBy = 1.05;
  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const oldScale = stage.scaleX();

    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale =
      e.evt.deltaY > 0 ? oldScale * scaleBy : oldScale / scaleBy;

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
  });
};
