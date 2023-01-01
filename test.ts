contraption.Scene.stats = true;

const scn = new contraption.Scene(new contraption.Engine({ gravity: new contraption.Gravity(0, 1, 0) }));
scn.camera.zoom = 4;
contraption.Scene.pushScene(scn);
const spr1 = new contraption.ImageSprite(img`
    . . . . . . . . . . b 5 b . . .
    . . . . . . . . . b 5 b . . . .
    . . . . . . . . . b c . . . . .
    . . . . . . b b b b b b . . . .
    . . . . . b b 5 5 5 5 5 b . . .
    . . . . b b 5 d 1 f 5 5 d f . .
    . . . . b 5 5 1 f f 5 d 4 c . .
    . . . . b 5 5 d f b d d 4 4 . .
    b d d d b b d 5 5 5 4 4 4 4 4 b
    b b d 5 5 5 b 5 5 4 4 4 4 4 b .
    b d c 5 5 5 5 d 5 5 5 5 5 b . .
    c d d c d 5 5 b 5 5 5 5 5 5 b .
    c b d d c c b 5 5 5 5 5 5 5 b .
    . c d d d d d d 5 5 5 5 5 d b .
    . . c b d d d d d 5 5 5 b b . .
    . . . c c c c c c c c b b . . .
`);

let rotationSpeed = 0.01;
spr1.onUpdate = (s) => {
    s.body.setAngle(s.body.angle + rotationSpeed);
}
spr1.onRender = (s) => {
}
scn.addSprite(spr1);

controller.up.addEventListener(ControllerButtonEvent.Pressed, () => {
    scn.camera.zoom += 0.25;
})
controller.up.addEventListener(ControllerButtonEvent.Repeated, () => {
    scn.camera.zoom += 0.25;
})
controller.down.addEventListener(ControllerButtonEvent.Pressed, () => {
    scn.camera.zoom -= 0.25;
})
controller.down.addEventListener(ControllerButtonEvent.Repeated, () => {
    scn.camera.zoom -= 0.25;
})
controller.left.addEventListener(ControllerButtonEvent.Pressed, () => {
    rotationSpeed -= 0.01;
})
controller.left.addEventListener(ControllerButtonEvent.Repeated, () => {
    rotationSpeed -= 0.01;
})
controller.right.addEventListener(ControllerButtonEvent.Pressed, () => {
    rotationSpeed += 0.01;
})
controller.right.addEventListener(ControllerButtonEvent.Repeated, () => {
    rotationSpeed += 0.01;
})
controller.setRepeatDefault(10, 10);
