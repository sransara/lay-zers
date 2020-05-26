import * as UI from './hudui'
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
function createGridTexture(size) {
    const graphics = new PIXI.Graphics()
    graphics.lineStyle(1, 0xf3f3f3, 1, 0)
    graphics.beginFill(0xffffff)
    graphics.drawRect(0, 0, size, size)
    graphics.endFill()
    return app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)
}

/* The world */
const world = new PIXI.Container()
app.stage.addChild(world)
const tileWorld = new PIXI.TilingSprite(createGridTexture(pixilSize), worldWidth, worldHeight);
const rayWorld = new PIXI.Container()
const fixtureWorld = new PIXI.Container()
world.addChild(tileWorld, rayWorld, fixtureWorld)

/* Utilities */
type Point = [number, number]
type Direv = [number, number]
type Unitv = [1 | 0 | -1, 1 | 0 | -1]
type ShapePoint = 'a' | 'b' | 'c' | 'd' | 'e'
type Emitter = { unitv: Unitv, color: number, a: Point, b: Point }

function gridToWorldA(a: Point) {
    return a.map((x: number) => x * pixilSize)
}

function worldToGrid(a: Point) {
    return a.map((x: number) => Math.floor(x / pixilSize))
}

function worldPointToPixilPoints(x: number, y: number): { [x in ShapePoint]: Point; }  {
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

function pointDistance(a: Point, b: Point) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
}

function abToVector(a: Point, b: Point): Direv {
    return [b[0] - a[0], b[1] - a[1]]
}

function vectorToOppositeVector(v: Direv): Direv {
    return [-1 * v[0], -1 * v[1]]
}

function vectorToUnitv(v: Direv): Unitv {
    return [
        v[0] = v[0] > 0 ? 1 : v[0] < 0 ? -1 : 0,
        v[1] = v[1] > 0 ? 1 : v[1] < 0 ? -1 : 0,
    ]
}

const layzers = Object.create(null)
class Layzer {
    ray: PIXI.Graphics
    color: number

    constructor(color: number) {
        this.ray = new PIXI.Graphics()
        this.color = color
        rayWorld.addChild(this.ray)
    }

    init() {
        this.ray.clear()
        this.ray.beginFill(0xffffff, 0.2)
        this.ray.tint = this.color
    }

    static new(color: number) {
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
    key: string
    vertices: Point[]
    sprite: PIXI.Sprite
    emitters: Emitter[]
    reflecting: boolean


    static new(color: number, shapePoints: ShapePoint[], pixilPoints: { [x in ShapePoint]: Point; }) {
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

    constructor(color: number, shapePoints: ShapePoint[], pixilPoints: { [x in ShapePoint]: Point; }) {
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

        this.reflecting = color == UI.reflectingColor

        this.emitters = []
        if (UI.emittingColors.includes(color)) {
            this.emitters = this.createEmitters(color, shapePoints, pixilPoints)
        }

        // prepare layzer
        Layzer.new(color)
    }

    private createFixtureTexture(color: number, shapePoints: ShapePoint[], pixilPoints: { [x in ShapePoint]: Point; }) {
        const graphics = new PIXI.Graphics()
        graphics.beginFill(color)

        let curr = [0, 0]
        // move curr to first point in the points path
        let a = pixilPoints['a']
        let b = pixilPoints[shapePoints[0]]
        curr[0] = curr[0] + (b[0] - a[0])
        curr[1] = curr[1] + (b[1] - a[1])
        graphics.moveTo(curr[0], curr[1])

        // draw the points in the points path
        let bpointi = 1
        // walk through all the sides of the fixture
        // except last side, because closePath will handle it
        while (bpointi < shapePoints.length) {
            a = pixilPoints[shapePoints[bpointi - 1]]
            b = pixilPoints[shapePoints[bpointi]]

            curr[0] = curr[0] + (b[0] - a[0])
            curr[1] = curr[1] + (b[1] - a[1])
            graphics.lineTo(curr[0], curr[1])

            bpointi = bpointi + 1
        }
        // close path closes the last side
        graphics.closePath()
        graphics.endFill()
        return app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)
    }

    private createEmitters(color: number, shapePoints: ShapePoint[], pixilPoints: { [x in ShapePoint]: Point; }) {
        const emitters = []

        // vertical and horizontal sides
        const vhsides = ["ab", "bd", "de", "ea"]
        let apointi = 0
        let bpointi = 1
        // walk through all the sides of the fixture
        while (apointi < shapePoints.length) {
            const sa = shapePoints[apointi]
            const sb = shapePoints[bpointi]

            if (vhsides.includes(sa + sb)) {
                const a = pixilPoints[sa]
                const b = pixilPoints[sb]
                const midab = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as Point
                const center = pixilPoints['c']
                const unitv = vectorToUnitv(abToVector(center, midab))

                emitters.push({ unitv, color, a, b })
            }
            else { // a slanted side through the center point
                const a = pixilPoints[sa]
                const b = pixilPoints[sb]
                const scorner = shapePoints.find((s) => !(s == sa || s == sb))
                const corner = pixilPoints[scorner]
                const center = pixilPoints['c']
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

function createVanishingSpriteTexture(size) {
    const graphics = new PIXI.Graphics()
    graphics.lineStyle(2, 0x00, 1, 0)
    graphics.beginFill(0xffffff)
    graphics.drawRect(0, 0, size, size)
    return app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)
}

const vanishingingSpriteTexture = createVanishingSpriteTexture(pixilSize * 2)
function addVanishingingSprite(c: Point) {
    const sprite = new PIXI.Sprite(vanishingingSpriteTexture)
    tileWorld.addChild(sprite)
    sprite.position.set(c[0], c[1])
    sprite.anchor.set(0.5)
    sprite.alpha = 0.8

    const tween = () => {
        if(sprite.width < pixilSize) {
            sprite.destroy()
            app.ticker.remove(tween)
        }
        else {
            sprite.scale.x /= 1.2
            sprite.scale.y /= 1.2
        }
    }
    app.ticker.add(tween)
}

function addFixture(worldX: number, worldY: number, color: number, shapePoints: ShapePoint[]) {
    const pixilPoints = worldPointToPixilPoints(worldX, worldY)
    Fixture.new(color, shapePoints, pixilPoints)
    addVanishingingSprite(pixilPoints.c)
    emitRays()
}

function removeFixture(worldX: number, worldY: number) {
    const pixilPoints = worldPointToPixilPoints(worldX, worldY)
    addVanishingingSprite(pixilPoints.c)
    Fixture.remove(pixilPoints)
    emitRays()
}

function closestVertexInDirection(a: Point, vertices: Point[], unitv: Unitv) {
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

function closestWallVertexInDirection(a: Point, unitv: Unitv) {
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

function getReflectingUnitv(unitv: Unitv, a: Point, b: Point) {
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

function emitRay(emitter: Emitter, srcFixture?: Fixture) {
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
function eventAction(ex: number, ey: number) {
    const rect = canvas.getBoundingClientRect()
    const x = ex - rect.left
    const y = ey - rect.top

    if (x < 0 || x > screenWidth || y < 0 || y > screenHeight) return

    const mode = document.querySelectorAll('.selectable-mode.selected')[0].getAttribute('data-mode')
    if (mode == "remove") {
        removeFixture(x, y)
    }
    else {
        addFixture(x, y, UI.selectedColor, UI.selectedShape as ShapePoint[])
    }
}

canvas.addEventListener('click', (e) => {
    eventAction(e.clientX, e.clientY)
})

import * as tippys from 'tippy.js';
canvas.addEventListener("touchstart", function (e) {
    if (e.touches.length > 1) return
    tippys.hideAll()
    let touch = e.touches[0];
    eventAction(touch.clientX, touch.clientY)
})

