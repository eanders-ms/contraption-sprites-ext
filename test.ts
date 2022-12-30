game.stats = true;


const scn = new contraption.Scene(new contraption.Engine({ gravity: new contraption.Gravity(0, 1, 0) }));
scn.camera.zoom = 4.5;
contraption.Scene.pushScene(scn);
const spr1 = new contraption.Sprite(img`
    . . . . . . . . . . b 5 b . . .
    . . . . . . . . . b 5 b . . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . . . . b b 5 d 1 f 5 d 4 c . .
    . . . . b 5 5 1 f f d d 4 4 4 b
    . . . . b 5 5 d f b 4 4 4 4 b .
    . . . b d 5 5 5 5 4 4 4 4 b . .
    . . b d d 5 5 5 5 5 5 5 5 b . .
    . b d d d d 5 5 5 5 5 5 5 5 b .
    b d d d b b b 5 5 5 5 5 5 5 b .
    c d d b 5 5 d c 5 5 5 5 5 5 b .
    c b b d 5 d c d 5 5 5 5 5 5 b .
    . b 5 5 b c d d 5 5 5 5 5 d b .
    b b c c c d d d d 5 5 5 b b . .
    . . . c c c c c c c c b b . . .
`);
spr1.onUpdate = (s) => {
    s.body.setAngle(s.body.angle + 0.01);
}
spr1.onRender = (s) => {
    const camera = s.scene.camera;
    const vertices = s.body.vertices;
    const extraPoints = s.body.extraPoints;

    const color = s.body.isStatic ? 6 : 5;

    for (let j = 0; j < vertices.length; ++j) {
        const vA = vertices[j];
        const vB = vertices[(j + 1) % vertices.length];

        const pA = camera.projectToScreen(vA);
        const pB = camera.projectToScreen(vB);

        screen.drawLine(pA.x, pA.y, pB.x, pB.y, color);
    }

    for (let j = 0; j < extraPoints.length; ++j) {
        const vA = extraPoints[j];
        const vB = extraPoints[(j + 1) % extraPoints.length];

        const pA = camera.projectToScreen(vA);
        const pB = camera.projectToScreen(vB);

        screen.drawLine(pA.x, pA.y, pB.x, pB.y, color + 1);
    }

    const pp = camera.projectToScreen(s.body.position);
    screen.setPixel(pp.x, pp.y, 11);
}
scn.addSprite(spr1);
