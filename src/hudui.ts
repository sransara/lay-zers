import tippy from 'tippy.js'
import 'tippy.js/dist/tippy.css'

const selectableModeElems = document.getElementsByClassName("selectable-mode")
Array.from(selectableModeElems).forEach((elem) => {
    elem.addEventListener('click', (event) => {
        Array.from(selectableModeElems).forEach((elem) => {
            elem.classList.remove("selected")
        });
        const targetElement = (event.currentTarget as Element)
        targetElement.classList.add('selected')
    })
})

export const blockingColor = 0x00
export const reflectingColor = 0x696969
export const emittingColors = [
    0xff0000,
    0x00ff00,
    0x0000ff
]
export let selectedColor = 0xff

export const allShapes = [
    ['a', 'd', 'e'],
    ['a', 'b', 'd'],
    ['a', 'b', 'e'],
    ['b', 'd', 'e'],
    ['a', 'b', 'd', 'e'],
]
export let selectedShape = ['a', 'b', 'd']

const layzerPreview = <HTMLCanvasElement>document.getElementById("layzerPreview")

function drawLayzerPreview(canvas, shape, color?) {
    const canvasCtx = canvas.getContext('2d');
    canvasCtx.fillStyle = "white"
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height)
    const pointMap = {
        'a': [0, 0],
        'b': [canvas.width, 0],
        'd': [canvas.width, canvas.height],
        'e': [0, canvas.height],
    }

    canvasCtx.beginPath()
    canvasCtx.moveTo(pointMap[shape[0]][0], pointMap[shape[0]][1])
    for (let s of shape.slice(0)) {
        canvasCtx.lineTo(pointMap[s][0], pointMap[s][1])
    }
    canvasCtx.closePath()
    if (color === undefined) {
        color = 0xd3d3d3
    }
    const scolor = '#' + color.toString(16).padStart(6, '0')
    canvasCtx.fillStyle = scolor
    canvasCtx.fill()
}
drawLayzerPreview(layzerPreview, selectedShape, selectedColor)

const layzerDesignerShapes = document.getElementById("layzerDesignerShapes")
const layzerDesginerShapesHolder = layzerDesignerShapes.querySelector(".item-row")
for (let shape of allShapes) {
    let canvas = document.createElement('canvas');
    canvas.style.width = "1.5rem"
    canvas.style.height = "1.5rem"
    layzerDesginerShapesHolder.appendChild(canvas)
    drawLayzerPreview(canvas, shape)
    if (shape.join('') == selectedShape.join('')) {
        canvas.classList.add('selected')
    }

    canvas.addEventListener('click', (e) => {
        Array.from(layzerDesginerShapesHolder.children).forEach((elem) => {
            elem.classList.remove("selected")
        });
        const targetElement = (event.currentTarget as Element)
        targetElement.classList.add('selected')
        selectedShape = shape
        drawLayzerPreview(layzerPreview, selectedShape, selectedColor)
    })
}

const layzerDesignerColors = document.getElementById("layzerDesignerColors")
const layzerDesginerColorsHolder = layzerDesignerColors.querySelector(".item-row")
let allColors = [blockingColor, reflectingColor, ...emittingColors]
for (let color of allColors) {
    let canvas = document.createElement('canvas');
    canvas.style.width = "1.5rem"
    canvas.style.height = "1.5rem"
    layzerDesginerColorsHolder.appendChild(canvas)
    drawLayzerPreview(canvas, ['a', 'b', 'd', 'e'], color)
    if (color == selectedColor) {
        canvas.classList.add('selected')
    }

    canvas.addEventListener('click', (e) => {
        Array.from(layzerDesginerColorsHolder.children).forEach((elem) => {
            elem.classList.remove("selected")
        });
        const targetElement = (event.currentTarget as Element)
        targetElement.classList.add('selected')
        selectedColor = color
        drawLayzerPreview(layzerPreview, selectedShape, selectedColor)
    })
}

const layzerBlockingColor = document.getElementById("layzerBlockingColor")
layzerBlockingColor.innerHTML = "&nbsp;".repeat(4)
layzerBlockingColor.style.width = "1em"
layzerBlockingColor.style.height = "1em"
layzerBlockingColor.style.backgroundColor = '#' + blockingColor.toString(16).padStart(6, '0')

const layzerReflectingColor = document.getElementById("layzerReflectingColor")
layzerReflectingColor.innerHTML = "&nbsp;".repeat(4)
layzerReflectingColor.style.width = "1em"
layzerReflectingColor.style.height = "1em"
layzerReflectingColor.style.backgroundColor = '#' + reflectingColor.toString(16).padStart(6, '0')


const layzerDesigner = document.getElementById('layzerDesigner');
layzerDesigner.style.display = 'block';
const btnLayzer = document.getElementById("btnLayzer")
tippy(btnLayzer, {
    content: layzerDesigner,
    trigger: 'click',
    placement: 'right',
    interactive: true,
    appendTo: document.body,
    onShow() {
        layzerPreview.classList.remove('shaking')
    }
})

function startTutorial() {
    const mainCanvas = <HTMLElement>document.querySelector("#main canvas")
    const tippyCanvas = tippy(mainCanvas, {
        content: 'Click anywhere to add a layzer',
        trigger: 'manual',
        arrow: false,
        placement: "right",
        offset: [-mainCanvas.clientHeight / 4, -mainCanvas.clientWidth * (3 / 4],
        onHidden() {
            layzerPreview.classList.add('shaking')
            const tippyBtnLayzer = tippy(btnLayzer, {
                content: 'Click here to design a layzer',
                trigger: 'manual',
                placement: "right",
                onHidden() { 
                    const tippyCanvas = tippy(mainCanvas, {
                        content: 'Add other layzers on the grid and see how they interact.',
                        allowHTML: true,
                        arrow: false,
                        trigger: 'manual',
                        placement: "right",
                        offset: [-mainCanvas.clientHeight / 4, -mainCanvas.clientWidth * (3/ 4)],
                    })
                    tippyCanvas.show()
                }
            })
            tippyBtnLayzer.show()
        }
    })
    tippyCanvas.show()

}

window.addEventListener('load', function () {
    document.getElementById("loading").remove()
    startTutorial()
})
