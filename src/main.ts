/* HUD UI */
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

const blockingColor = 0x00
const reflectingColor = 0x696969
const emittingColors = [
    0xff0000,
    0x00ff00,
    0x0000ff
]
let selectedColor = 0xff

const allShapes = [
    ['a', 'd', 'e'],
    ['a', 'b', 'd'],
    ['a', 'b', 'e'],
    ['b', 'd', 'e'],
    ['a', 'b', 'd', 'e'],
]
let selectedShape = ['a', 'b', 'd']

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

const remSize = parseInt(getComputedStyle(document.documentElement).fontSize)
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
})


/* Lazyzers */
import * as PIXI from 'pixi.js'

const pixilSize = parseInt(getComputedStyle(document.documentElement).fontSize) * 2
const layzerCanvasHolder = document.getElementById("main")
let [screenWidth, screenHeight] = [layzerCanvasHolder.clientWidth, layzerCanvasHolder.clientHeight]
const [gridWidthUnits, gridHeightUnits] = [Math.floor(screenWidth / pixilSize), Math.floor(screenHeight / pixilSize)]
const [worldWidth, worldHeight] = [pixilSize * gridWidthUnits, pixilSize * gridHeightUnits]
if (worldWidth < screenWidth || worldHeight < screenHeight) {
    [screenWidth, screenHeight] = [worldWidth, worldHeight]
}

/* Setup the world */
const app = new PIXI.Application({
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 0xc0c0c0,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
})
const canvas = app.view
layzerCanvasHolder.appendChild(canvas)

/* Textures and sprites */
let graphics = new PIXI.Graphics()
graphics.lineStyle(1, 0xf3f3f3, 1, 0)
graphics.beginFill(0xffffff)
graphics.drawRect(0, 0, pixilSize, pixilSize)
graphics.endFill()
const pixilTexture = app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)

/* The world */
const world = new PIXI.Container()
app.stage.addChild(world)
const tileWorld = new PIXI.TilingSprite(pixilTexture, worldWidth, worldHeight);
//tileWorld.zIndex = 0
const rayWorld = new PIXI.Container()
//rayWorld.zIndex = 1
const fixtureWorld = new PIXI.Container()
//fixtureWorld.zIndex = 2
world.addChild(tileWorld, rayWorld, fixtureWorld)

/* Utilities */
function gridToWorldA(a: number[]) {
    return a.map((x: number) => x * pixilSize)
}

function worldToGrid(a: number[]) {
    return a.map((x: number) => Math.floor(x / pixilSize))
}

function worldPointToPixilPoints(x: number, y: number) {
    /*
           a------b                                                         
           |      |                                                         
           |  c   |                                                         
           |      |                                                         
           e------d
    */
    const [gi, gj] = worldToGrid([x, y])
    const [ax, ay] = gridToWorldA([gi, gj])
    const [bx, by] = [ax + pixilSize, ay]
    const [cx, cy] = [ax + (pixilSize / 2), ay + (pixilSize / 2)]
    const [dx, dy] = [ax + pixilSize, ay + pixilSize]
    const [ex, ey] = [ax, ay + pixilSize]
    return { a: [ax, ay], b: [bx, by], c: [cx, cy], d: [dx, dy], e: [ex, ey] }
}

function pointDistance(a: number[], b: number[]) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function abToVector(a, b) {
    return [b[0] - a[0], b[1] - a[1]]
}

function vectorToOppositeVector(v) {
    return [-1 * v[0], -1 * v[1]]
}

function vectorToUnitv(v) {
    return [
        v[0] = v[0] > 0 ? 1 : v[0] < 0 ? -1 : 0,
        v[1] = v[1] > 0 ? 1 : v[1] < 0 ? -1 : 0,
    ]
}

const layzers = Object.create(null)
class Layzer {
    ray: any
    color: any

    constructor(color) {
        this.ray = new PIXI.Graphics()
        this.color = color
        rayWorld.addChild(this.ray)
    }

    init() {
        this.ray.clear()
        this.ray.beginFill(0xffffff, 0.2)
        this.ray.tint = this.color
    }

    static new(color) {
        if (layzers[color] != undefined) {
            return layzers[color]
        }
        const layzer = new Layzer(color)
        layzers[color] = layzer
        return layzer
    }
}

const fixtureTextureCache = Object.create(null)
const fixtures = Object.create(null);
class Fixture {
    key: any
    vertices: any
    sprite: any
    emitters: any
    reflecting: boolean


    static new(color, shapePoints, pixilPoints) {
        const fixture = new Fixture(color, shapePoints, pixilPoints)
        if (fixtures[fixture.key] != undefined) {
            fixtures[fixture.key].destroy()
        }
        fixtures[fixture.key] = fixture
    }

    static remove(pixilPoints) {
        const key = pixilPoints.a.join(',')
        if (fixtures[key] != undefined) {
            fixtures[key].destroy()
        }
    }

    constructor(color, shapePoints, pixilPoints) {
        // fixture key == origin point (a) in the world
        this.key = pixilPoints.a.join(',')

        // vertices of the fixture in terms of world points
        this.vertices = shapePoints.map((c: string) => pixilPoints[c])
        if (shapePoints.length == 3) {
            this.vertices.push(pixilPoints['c'])
        }

        // for the sprite, do we have the texture for this color and point pattern?
        const fixtureTextureCacheKey = `${shapePoints.join(',')},${color.toString(16)}`
        let fixtureTexture = fixtureTextureCache[fixtureTextureCacheKey]
        if (fixtureTexture == undefined) {
            // if not generate the texture
            fixtureTexture = this.createFixtureTexture(color, shapePoints, pixilPoints)
            fixtureTextureCache[fixtureTextureCacheKey] = fixtureTexture
        }

        // add the sprite to the world with generated texture
        const sprite = new PIXI.Sprite(fixtureTexture)
        tileWorld.addChild(sprite)
        sprite.position.set(pixilPoints.a[0], pixilPoints.a[1])
        this.sprite = sprite

        this.reflecting = color == reflectingColor

        this.emitters = []
        if (!(color == blockingColor || color == reflectingColor)) {
            this.emitters = this.createEmitters(color, shapePoints, pixilPoints)
        }

        // prepare layzer
        Layzer.new(color)
    }

    private createFixtureTexture(color, shapePoints, worldPoints) {
        const graphics = new PIXI.Graphics()
        graphics.beginFill(color)

        let curr = [0, 0]
        // move curr to first point in the points path
        const a = worldPoints['a']
        const b = worldPoints[shapePoints[0]]
        curr[0] = curr[0] + (b[0] - a[0])
        curr[1] = curr[1] + (b[1] - a[1])
        graphics.moveTo(curr[0], curr[1])


        // draw the points in the points path
        let apointi = 0
        let bpointi = 1
        // walk through all the sides of the fixture
        while (apointi < shapePoints.length) {
            const a = worldPoints[shapePoints[apointi]]
            const b = worldPoints[shapePoints[bpointi]]

            curr[0] = curr[0] + (b[0] - a[0])
            curr[1] = curr[1] + (b[1] - a[1])
            graphics.lineTo(curr[0], curr[1])

            apointi = (apointi + 1)
            bpointi = (bpointi + 1) % shapePoints.length
        }

        graphics.closePath()
        graphics.endFill()
        return app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)
    }

    private createEmitters(color, shapePoints: string[], worldPoints) {
        const emitters = []

        let apointi = 0
        let bpointi = 1

        const vhsides = ["ab", "bd", "de", "ea"]

        // walk through all the sides of the fixture
        while (apointi < shapePoints.length) {
            const sa = shapePoints[apointi]
            const sb = shapePoints[bpointi]

            if (vhsides.includes(sa + sb)) {
                const a = worldPoints[sa]
                const b = worldPoints[sb]
                const midab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
                const center = worldPoints['c']
                const unitv = vectorToUnitv(abToVector(center, midab))

                emitters.push({ unitv, color, a, b })
            }
            else { // a slanted side through the center point
                const a = worldPoints[sa]
                const b = worldPoints[sb]
                const scorner = shapePoints.find((s) => !(s == sa || s == sb))
                const corner = worldPoints[scorner]
                const center = worldPoints['c']
                const unitv = vectorToUnitv(abToVector(corner, center))

                emitters.push({ unitv, color, a: a, b: corner })
                emitters.push({ unitv, color, a: b, b: corner })
            }

            apointi = (apointi + 1)
            bpointi = (bpointi + 1) % shapePoints.length
        }

        return emitters
    }

    destroy() {
        this.sprite.destroy()
        fixtures[this.key] = undefined
    }
}

function addFixture(screenX: number, screenY: number, color, shapePoints) {
    const pixilPoints = worldPointToPixilPoints(screenX, screenY)
    Fixture.new(color, shapePoints, pixilPoints)
    emitRays()
}

function removeFixture(screenX: number, screenY: number) {
    const pixilPoints = worldPointToPixilPoints(screenX, screenY)
    Fixture.remove(pixilPoints)
    emitRays()
}

function closestVertexInDirection(a, vertices, unitv) {
    let vertexClosestDistance = Infinity
    let vertexClosest = undefined
    for (const vertex of vertices) {
        const dx = vertex[0] - a[0]
        if (unitv[0] == 0 && !(dx == 0)) continue
        if (unitv[0] < 0 && !(dx <= 0)) continue
        if (unitv[0] > 0 && !(dx >= 0)) continue

        const dy = vertex[1] - a[1]
        if (unitv[1] == 0 && !(dy == 0)) continue
        if (unitv[1] < 0 && !(dy <= 0)) continue
        if (unitv[1] > 0 && !(dy >= 0)) continue

        if (Math.abs(unitv[0]) == Math.abs(unitv[1]) && !(Math.abs(dx) == Math.abs(dy))) continue

        const pd = pointDistance(a, vertex)
        if (pd < vertexClosestDistance) {
            vertexClosest = vertex
            vertexClosestDistance = pd
        }
    }
    return vertexClosest
}

function closestWallVertexInDirection(a, unitv) {
    let wallx = worldWidth
    if (unitv[0] == -1) {
        wallx = 0
    }

    let wally = worldHeight
    if (unitv[1] == -1) {
        wally = 0
    }

    let vertices = []
    if (unitv[0] != 0) {
        let m = (wallx - a[0]) / unitv[0]
        let y = a[1] + (unitv[1] * m)
        vertices.push([wallx, y])
    }

    if (unitv[1] != 0) {
        let m = (wally - a[1]) / unitv[1]
        let x = a[0] + (unitv[0] * m)
        vertices.push([x, wally])
    }

    return closestVertexInDirection(a, vertices, unitv)
}

function getReflectingUnitv(unitv, a, b) {
    const dv = abToVector(a, b)
    // get unit vector direction of a -> b
    const duv1 = vectorToUnitv(dv)
    // it could have been b -> a, so make oppoise unitv
    const duv2 = vectorToOppositeVector(duv1)

    const sduv = [duv1, duv2].map((v) => v.join(','))

    let curr = unitv
    let count = 0
    do {
        count += 1
        curr = vectorToUnitv([(curr[0] - curr[1]), (curr[1] + curr[0])])
    } while (!sduv.includes(curr.join(',')))

    while (count > 0) {
        count -= 1
        curr = vectorToUnitv([(curr[0] - curr[1]), (curr[1] + curr[0])])
    }
    return curr
}

function emitRay(emitter, srcFixture?) {
    const { unitv, color, a, b } = emitter
    let borderClosestDistance = Infinity
    let borderClosest = undefined
    let fixtureClosest = undefined
    for (const fixtureKey in fixtures) {
        if (srcFixture && srcFixture.key == fixtureKey) continue

        const fixture = fixtures[fixtureKey]
        if (fixture === undefined) continue
        const acv = closestVertexInDirection(a, fixture.vertices, unitv)
        if (!acv) continue
        const bcv = closestVertexInDirection(b, fixture.vertices, unitv)
        if (!bcv) continue

        const borderDistance = pointDistance(a, acv) + pointDistance(b, bcv)
        if (borderDistance < borderClosestDistance) {
            borderClosest = [acv, bcv]
            fixtureClosest = fixture
            borderClosestDistance = borderDistance
        }
    }
    if (!borderClosest) {
        const acv = closestWallVertexInDirection(a, unitv)
        const bcv = closestWallVertexInDirection(b, unitv)
        borderClosest = [acv, bcv]
    }

    const ray = layzers[color].ray
    ray.moveTo(a[0], a[1])
    ray.lineTo(borderClosest[0][0], borderClosest[0][1])
    ray.lineTo(borderClosest[1][0], borderClosest[1][1])
    ray.lineTo(b[0], b[1])
    ray.lineTo(a[0], a[1])
    ray.closePath()

    if (!(fixtureClosest && fixtureClosest.reflecting)) return

    const reflectingUnitv = getReflectingUnitv(unitv, borderClosest[0], borderClosest[1])
    return [{ unitv: reflectingUnitv, color, a: borderClosest[0], b: borderClosest[1] }, fixtureClosest]
}

function emitRays() {
    for (const layzerKey in layzers) {
        const layzer = layzers[layzerKey]
        if (layzer == undefined) continue
        layzer.init()
    }

    let moreEmitters = []
    for (const fixtureKey in fixtures) {
        const fixture = fixtures[fixtureKey]
        if (fixture === undefined) continue
        for (const emitter of fixture.emitters) {
            const reflectedEmitter = emitRay(emitter, fixture)
            if (reflectedEmitter != undefined) {
                moreEmitters.push(reflectedEmitter)
            }
        }
    }

    while (moreEmitters.length > 0) {
        const [emitter, reflector] = moreEmitters.pop()
        const reflectedEmitter = emitRay(emitter, reflector)
        if (reflectedEmitter != undefined) {
            moreEmitters.push(reflectedEmitter)
        }
    }
}

/* Events */
function eventAction(ex, ey) {
    const rect = canvas.getBoundingClientRect()
    const x = ex - rect.left
    const y = ey - rect.top

    if (x < 0 || x > screenWidth || y < 0 || y > screenHeight) return

    const mode = document.querySelectorAll('.selectable-mode.selected')[0].getAttribute('data-mode')
    if (mode == "remove") {
        removeFixture(x, y)
    }
    else {
        addFixture(x, y, selectedColor, selectedShape)
    }
}

canvas.addEventListener('click', (e) => {
    eventAction(e.clientX, e.clientY)
})

canvas.addEventListener("touchstart", function (e) {
    if (e.touches.length > 1) return
    let touch = e.touches[0];
    eventAction(touch.clientX, touch.clientY)
})

document.getElementById("loading").remove()
