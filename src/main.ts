import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'

const pixilSize = parseInt(getComputedStyle(document.documentElement).fontSize) * 2
const canvasHolder = document.getElementById("main")
const [screenWidth, screenHeight] = [canvasHolder.clientWidth, canvasHolder.clientHeight]
const [gridWidthUnits, gridHeightUnits] = [Math.floor(screenWidth / pixilSize), Math.floor(screenHeight / pixilSize)]
const [worldWidth, worldHeight] = [pixilSize * gridWidthUnits, pixilSize * gridHeightUnits]

/* Setup the world */
const app = new PIXI.Application({
    width: screenWidth,
    height: screenHeight,
    backgroundColor: 0xf3f3f3,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
})
const canvas = app.view
canvasHolder.appendChild(canvas)

const viewport = new Viewport({
    screenWidth: screenWidth,
    screenHeight: screenHeight,
    worldWidth: worldWidth,
    worldHeight: worldHeight,
    interaction: app.renderer.plugins.interaction,
})
app.stage.addChild(viewport)
viewport.drag({ mouseButtons: 'left' }).wheel().pinch({ noDrag: true }).bounce()
viewport.clampZoom({ minScale: viewport.scale.x, maxScale: screenWidth / (10 * pixilSize) })

/* Textures and sprites */
let graphics = new PIXI.Graphics()
graphics.lineStyle(1, 0xf3f3f3, 1, 0)
graphics.beginFill(0xffffff)
graphics.drawRect(0, 0, pixilSize, pixilSize)
graphics.endFill()
const pixilTexture = app.renderer.generateTexture(graphics, PIXI.SCALE_MODES.LINEAR, 2)

/* The world */
const world = viewport.addChild(new PIXI.Container())
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

const reflectingColor = 0x696969
const absorbingColor = 0x00

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


    static new(color, shapePoints, worldPoints) {
        const fixture = new Fixture(color, shapePoints, worldPoints)
        if (fixtures[fixture.key] != undefined) {
            fixtures[fixture.key].destroy()
        }
        fixtures[fixture.key] = fixture
    }

    constructor(color, shapePoints, worldPoints) {
        // fixture key == origin point (a) in the world
        this.key = worldPoints.a.join(',')

        // vertices of the fixture in terms of world points
        this.vertices = shapePoints.map((c: string) => worldPoints[c])
        if (shapePoints.length == 3) {
            this.vertices.push(worldPoints['c'])
        }

        // for the sprite, do we have the texture for this color and point pattern?
        const fixtureTextureCacheKey = `${shapePoints.join(',')},${color.toString(16)}`
        let fixtureTexture = fixtureTextureCache[fixtureTextureCacheKey]
        if (fixtureTexture == undefined) {
            // if not generate the texture
            fixtureTexture = this.createFixtureTexture(color, shapePoints, worldPoints)
            fixtureTextureCache[fixtureTextureCacheKey] = fixtureTexture
        }

        // add the sprite to the world with generated texture
        const sprite = new PIXI.Sprite(fixtureTexture)
        tileWorld.addChild(sprite)
        sprite.position.set(worldPoints.a[0], worldPoints.a[1])
        this.sprite = sprite

        this.reflecting = color == reflectingColor

        this.emitters = []
        if (!(color == absorbingColor || color == reflectingColor)) {
            this.emitters = this.createEmitters(color, shapePoints, worldPoints)
        }

        // prepare layzer
        Layzer.new(color)
    }

    private createFixtureTexture(color, points, worldPoints) {
        const graphics = new PIXI.Graphics()
        graphics.beginFill(color)

        let curr = [0, 0]
        // move curr to first point in the points path
        const a = worldPoints['a']
        const b = worldPoints[points[0]]
        curr[0] = curr[0] + (b[0] - a[0])
        curr[1] = curr[1] + (b[1] - a[1])
        graphics.moveTo(curr[0], curr[1])


        // draw the points in the points path
        let apointi = 0
        let bpointi = 1
        // walk through all the sides of the fixture
        while (apointi < points.length) {
            const a = worldPoints[points[apointi]]
            const b = worldPoints[points[bpointi]]

            curr[0] = curr[0] + (b[0] - a[0])
            curr[1] = curr[1] + (b[1] - a[1])
            graphics.lineTo(curr[0], curr[1])

            apointi = (apointi + 1)
            bpointi = (bpointi + 1) % points.length
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

                emitters.push({ unitv, color, a: a, b: corner})
                emitters.push({ unitv, color, a: b, b: corner})
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
    const worldPoint = viewport.toWorld(screenX, screenY)
    const pixilPoints = worldPointToPixilPoints(worldPoint.x, worldPoint.y)
    Fixture.new(color, shapePoints, pixilPoints)
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
canvas.oncontextmenu = (e: MouseEvent) => {
    e.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    addFixture(x, y, 0X696969, ['a', 'b', 'd', 'e'])
}
canvas.ondblclick = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    addFixture(x, y, 0xff, ['a', 'b', 'd'])
}
