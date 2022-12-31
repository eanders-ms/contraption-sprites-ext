namespace contraption {
    export class Sprite {
        id: number;
        body: Body;
        scene: Scene;

        static coloredPixelShader = new ColoredPixelShader();
        static texturedPixelShader = new TexturedPixelShader();

        onUpdate: (s: Sprite) => void;
        onRender: (s: Sprite) => void;

        constructor() {
            this.id = Common.nextId();
        }

        update(): void {
            if (this.onUpdate) this.onUpdate(this);
        }

        render(): void {
            if (this.onRender) this.onRender(this);
        }
    }

    export class ImageSprite extends Sprite {
        image: Image;

        constructor(img: Image) {
            super();
            this.setImage(img);
        }

        setImage(img: Image) {
            const l = img.width / -2;
            const t = img.height / -2;
            const r = -l - 1;
            const b = -t - 1;
            this.image = img;
            // Get the convex hull of the image. This is a lazy implementation, could be more efficient.
            const points: Vector[] = [];
            for (let y = 0; y < img.height; ++y) {
                for (let x = 0; x < img.width; ++x) {
                    if (img.getPixel(x, y)) {
                        points.push(new Vector(x + l, y + t));
                    }
                }
            }
            Vector.ClockwiseSortInPlace(points);
            const hull = Vertex.Hull(Vertex.Create(points));
            const imgbox: Vector[] = [];
            imgbox.push(new Vector(l, t))
            imgbox.push(new Vector(r, t));
            imgbox.push(new Vector(r, b));
            imgbox.push(new Vector(l, b));
            this.body = new Body({
                vertices: hull,
                extraPoints: imgbox
            });
        }

        update() {
            super.update();
        }

        render() {
            super.render();

            const camera = this.scene.camera;
            const vertices = this.body.vertices;
            const extraPoints = this.body.extraPoints;
            const renderer = this.scene.renderer;

            const color = this.body.isStatic ? 6 : 5;

            for (let j = 0; j < vertices.length; ++j) {
                const vA = vertices[j];
                const vB = vertices[(j + 1) % vertices.length];

                const pA = camera.projectToScreen(vA);
                const pB = camera.projectToScreen(vB);

                const cmd = new DrawLineCommand(Sprite.coloredPixelShader);
                const v0 = cmd.v0 = new ColoredVertex();
                v0.x = pA.x;
                v0.y = pA.y;
                v0.color = color;

                const v1 = cmd.v1 = new ColoredVertex();
                v1.x = pB.x;
                v1.y = pB.y;
                v1.color = color;

                renderer.queueDrawCommand(cmd);
            }

            for (let j = 0; j < extraPoints.length; ++j) {
                const vA = extraPoints[j];
                const vB = extraPoints[(j + 1) % extraPoints.length];

                const pA = camera.projectToScreen(vA);
                const pB = camera.projectToScreen(vB);

                const cmd = new DrawLineCommand(Sprite.coloredPixelShader);
                const v0 = cmd.v0 = new ColoredVertex();
                v0.x = pA.x;
                v0.y = pA.y;
                v0.color = color + 1;

                const v1 = cmd.v1 = new ColoredVertex();
                v1.x = pB.x;
                v1.y = pB.y;
                v1.color = color + 1;

                renderer.queueDrawCommand(cmd);
            }

            const pp = camera.projectToScreen(this.body.position);
            screen.setPixel(pp.x, pp.y, 11);

        }
    }
}
