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
        private image: Image;
        private tri0: DrawTriangleCommand;
        private tri1: DrawTriangleCommand;

        constructor(img: Image) {
            super();
            this.tri0 = new DrawTriangleCommand(Sprite.texturedPixelShader);
            this.tri1 = new DrawTriangleCommand(Sprite.texturedPixelShader);
            // set uv coords - tri0
            this.tri0.v0.props[0] = 0; this.tri0.v0.props[1] = 0;
            this.tri0.v1.props[0] = 1; this.tri0.v1.props[1] = 0;
            this.tri0.v2.props[0] = 1; this.tri0.v2.props[1] = 1;
            // set uv coords - tri1
            this.tri1.v0.props[0] = 1; this.tri1.v0.props[1] = 1;
            this.tri1.v1.props[0] = 0; this.tri1.v1.props[1] = 1;
            this.tri1.v2.props[0] = 0; this.tri1.v2.props[1] = 0;
            this.setImage(img);
        }

        setImage(img: Image) {
            const l = img.width / -2;
            const t = img.height / -2;
            const r = -l;
            const b = -t;
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
            const corners: Vector[] = [];
            corners.push(new Vector(l, t))
            corners.push(new Vector(r, t));
            corners.push(new Vector(r, b));
            corners.push(new Vector(l, b));
            this.body = new Body({
                vertices: hull,
                extraPoints: corners
            });
        }

        update() {
            super.update();
        }

        render() {
            super.render();

            const camera = this.scene.camera;
            const corners = this.body.extraPoints;
            const renderer = this.scene.renderer;

            const lt = camera.projectToScreen(corners[0]);
            const rt = camera.projectToScreen(corners[1]);
            const rb = camera.projectToScreen(corners[2]);
            const lb = camera.projectToScreen(corners[3]);

            Sprite.texturedPixelShader.texture = this.image;
            // update coords - TODO, only do this when the body motion changes
            this.tri0.v0.x = lt.x;
            this.tri0.v0.y = lt.y;
            this.tri0.v1.x = rt.x;
            this.tri0.v1.y = rt.y;
            this.tri0.v2.x = rb.x;
            this.tri0.v2.y = rb.y;
            this.tri1.v0.x = rb.x;
            this.tri1.v0.y = rb.y;
            this.tri1.v1.x = lb.x;
            this.tri1.v1.y = lb.y;
            this.tri1.v2.x = lt.x;
            this.tri1.v2.y = lt.y;
            renderer.queueDrawCommand(this.tri0);
            renderer.queueDrawCommand(this.tri1);
        }
    }
}
