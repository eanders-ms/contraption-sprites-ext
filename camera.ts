namespace contraption {
    export class Camera {
        size: Vector;
        pos: Vector;
        private zoom_: number;

        constructor() {
            this.pos = new Vector();
            this.zoom = 1;
        }

        get zoom(): number {
            return this.zoom_;
        }
        set zoom(v: number) {
            this.zoom_ = v = Math.max(0.0001, v);
            this.size = new Vector(screen.width * v, screen.height * v);
        }

        projectToScreen(pos: Vector, ref?: Vector): Vector {
            if (!ref) ref = new Vector();
            const scale = new Vector(this.size.x / screen.width, this.size.y / screen.height);
            ref.x = pos.x - this.pos.x;
            ref.y = pos.y - this.pos.y;
            ref.x *= scale.x;
            ref.y *= scale.y;
            ref.x += screen.width >> 1;
            ref.y += screen.height >> 1;
            return ref;
        }
    }
}
