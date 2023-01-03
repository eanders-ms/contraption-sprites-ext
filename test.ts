contraption.Scene.stats = true;

const scn = new contraption.Scene(new contraption.Engine({ gravity: new contraption.Gravity(0, 1, 0) }));
scn.camera.zoom = 1;
contraption.Scene.pushScene(scn);
const spr1 = new contraption.ImageSprite(img`
    ........................
    ........................
    ...........cc...........
    ...........cccc.........
    .......cc...ccccccc.....
    .......cccccc555555cc...
    ........ccb5555555555c..
    .....cc..b555555555555c.
    .....cccb555555ff155555c
    .....ccb55555555ff55d55c
    ......b5555555555555555c
    ...c..b555d55555bb13bbc.
    ...cccd55ddddd55bb3335c.
    ....cbdddddddddd55b335c.
    ..cccdddddb55bdddd5555c.
    ..cccdddddb555bbbbcccc..
    ...ccddddddb5555cbcdc...
    ccccbdddddddcb55cbcc....
    cddddddddd55dbccbbc.....
    cbdddddddd555dbbbcc.....
    .ccbdddbbdd555bbcdbcc...
    ...cccbbbbdd55ccdddbc...
    ......cccbdddbccccccc...
    ........cdd555dc........
`);

let rotationSpeed = 0;
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
controller.A.addEventListener(ControllerButtonEvent.Pressed, () => {
    rotationSpeed = 0;
})
controller.setRepeatDefault(10, 10);
