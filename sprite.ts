namespace contraption {
    export class Sprite {
        id: number;
        body: Body;
        scene: Scene;
        image: Image;

        onUpdate: (s: Sprite) => void;
        onRender: (s: Sprite) => void;

        constructor(img: Image) {
            this.id = Common.nextId();
            this.setImage(img);
        }

        setImage(img: Image) {
            const r = img.width / 2;
            const b = img.height / 2;
            const l = -r;
            const t = -b;
            this.image = img;
            // This is lazy, could be more efficient.
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
            const extraPoints: Vector[] = [];
            extraPoints.push(new Vector(l, t))
            extraPoints.push(new Vector(r, t));
            extraPoints.push(new Vector(r, b));
            extraPoints.push(new Vector(l, b));
            this.body = new Body({
                vertices: hull,
                extraPoints
            });
            //this.body = Bodies.CreateRectangle(0, 0, img.width, img.height);
        }

        update(): void {
            if (this.onUpdate) this.onUpdate(this);
        }

        render(): void {
            if (this.onRender) this.onRender(this);
        }
    }
}
