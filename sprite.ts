namespace contraption {
    export class Sprite {
        id: number;
        body: Body;
        scene: Scene;
        image: Image;

        constructor(img: Image) {
            this.id = Common.nextId();
            this.image = img;
            this.body = Bodies.CreateRectangle(0, 0, img.width, img.height);
            // TODO: Offer alternative body shapes: convex hull, circle
        }

        update(): void {
        }

        render(): void {
            const vertices = this.body.vertices;

            let color = this.body.isStatic ? 6 : 5;

            for (let j = 0; j < vertices.length; ++j) {
                const vertA = vertices[j];
                const vertB = vertices[(j + 1) % vertices.length];

                const pA = this.scene.camera.projectToScreen(vertA);
                const pB = this.scene.camera.projectToScreen(vertB);

                screen.drawLine(pA.x, pA.y, pB.x, pB.y, color);
            }
        }
    }
}
