namespace contraption {
    export class RasterizerVertex extends Vector {
        props: number[]; // interpolated vertex properties (tex coords, for example)

        constructor() {
            super();
            this.props = [];
        }
    }

    export class ColoredVertex extends RasterizerVertex {
        constructor() {
            super();
            this.props.push(0); // color
        }

        get color(): number {
            return this.props[0];
        }
        set color(n: number) {
            this.props[0] = n;
        }
    }

    export class TexturedVertex extends RasterizerVertex {
        constructor() {
            super();
            this.props.push(0); // u
            this.props.push(0); // v
        }

        get u(): number {
            return this.props[0];
        }
        set u(n: number) {
            this.props[0] = n;
        }
        get v(): number {
            return this.props[1];
        }
        set v(n: number) {
            this.props[1] = n;
        }
    }

    export class DrawCommand {
        shader: PixelShader;
        constructor(shader: PixelShader) {
            this.shader = shader;
        }
        prepare(rasterizer: Rasterizer) {
            rasterizer.setPixelShader(this.shader);
        }
        draw(rasterizer: Rasterizer) {
            // overridden
        }
    }

    export class DrawPointCommand extends DrawCommand {
        v: RasterizerVertex;

        constructor(shader: PixelShader) {
            super(shader);
            this.v = new RasterizerVertex();
        }

        draw(rasterizer: Rasterizer) {
            rasterizer.drawPoint(this);
        }
    }

    export class DrawLineCommand extends DrawCommand {
        v0: RasterizerVertex;
        v1: RasterizerVertex;

        constructor(shader: PixelShader) {
            super(shader);
            this.v0 = new RasterizerVertex();
            this.v1 = new RasterizerVertex();
        }

        draw(rasterizer: Rasterizer) {
            rasterizer.drawLine(this);
        }
    }

    export class DrawTriangleCommand extends DrawCommand {
        v0: RasterizerVertex;
        v1: RasterizerVertex;
        v2: RasterizerVertex;

        constructor(shader: PixelShader) {
            super(shader);
            this.v0 = new RasterizerVertex();
            this.v1 = new RasterizerVertex();
            this.v2 = new RasterizerVertex();
        }

        draw(rasterizer: Rasterizer) {
            rasterizer.drawTriangle(this);
        }
    }

    // Edge equation described in many places, including:
    // * https://www.cs.unc.edu/xcms/courses/comp770-s07/Lecture08.pdf
    // * https://www.researchgate.net/publication/286441992_Accelerated_Half-Space_Triangle_Rasterization
    export class EdgeEquation {
        a: number;
        b: number;
        c: number;
        tie: boolean;

        constructor(v0: RasterizerVertex, v1: RasterizerVertex) {
            this.a = v0.y - v1.y;
            this.b = v1.x - v0.x;
            this.c = -(this.a * (v0.x + v1.x) + this.b * (v0.y + v1.y)) / 2;
        }

        evaluate(x: number, y: number): number {
            return this.a * x + this.b * y + this.c;
        }

        testPoint(x: number, y: number): boolean {
            return this.testValue(this.evaluate(x, y));
        }

        testValue(v: number): boolean {
            return (v > 0 || (v === 0 && this.tie));
        }

        stepX(v: number): number {
            return v + this.a;
        }

        stepXScaled(v: number, step: number): number {
            return v + this.a * step;
        }

        stepY(v: number): number {
            return v + this.b;
        }

        stepYScaled(v: number, step: number): number {
            return v + this.b * step;
        }
    }

    // Same as EdgeEquation, just initialized differently for parameter interpolations (tex coords, for example)
    export class ParameterEquation {
        a: number;
        b: number;
        c: number;

        constructor(p0: number, p1: number, p2: number, e0: EdgeEquation, e1: EdgeEquation, e2: EdgeEquation) {
            this.a = p0 * e0.a + p1 * e1.a + p2 * e1.a;
            this.b = p0 * e0.b + p1 * e1.b + p2 * e1.b;
            this.c = p0 * e0.c + p1 * e1.c + p2 * e1.c;
        }

        evaluate(x: number, y: number): number {
            return this.a * x + this.b * y + this.c;
        }

        stepX(v: number): number {
            return v + this.a;
        }

        stepXScaled(v: number, step: number): number {
            return v + this.a * step;
        }

        stepY(v: number): number {
            return v + this.b;
        }

        stepYScaled(v: number, step: number): number {
            return v + this.b * step;
        }
    }

    export class TriangleEquation {
        area2: number;
        e0: EdgeEquation;
        e1: EdgeEquation;
        e2: EdgeEquation;
        props: ParameterEquation[];

        constructor(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            this.e0 = new EdgeEquation(v1, v2);
            this.e1 = new EdgeEquation(v2, v0);
            this.e2 = new EdgeEquation(v0, v1);

            this.area2 = this.e0.c + this.e1.c + this.e2.c;

            if (this.area2 <= 0) return;

            for (let i = 0; i < v0.props.length; ++i) {
                this.props.push(new ParameterEquation(v0.props[i], v1.props[i], v2.props[i], this.e0, this.e1, this.e2));
            }
        }
    }

    export class PixelData {
        x: number;
        y: number;
        props: number[];

        initFromVertex(v: RasterizerVertex) {
            this.props = [];
            this.x = v.x;
            this.y = v.y;
            for (let i = 0; i < v.props.length; ++i)
                this.props.push(v.props[i]);
        }

        initFromTriangleEquation(eqn: TriangleEquation, x: number, y: number) {
            this.props = [];
            for (let i = 0; i < eqn.props.length; ++i) {
                this.props.push(eqn.props[i].evaluate(x, y));
            }
        }

        stepX(eqn: TriangleEquation) {
            for (let i = 0; i < eqn.props.length; ++i)
                this.props[i] = eqn.props[i].stepX(this.props[i]);
        }
    }
   
    export class PixelShader {
        drawPixel(p: PixelData) {
            // overridden
        }
        drawSpan(eqn: TriangleEquation, x: number, y: number, x2: number) {
            const xf = x + 0.5;
            const yf = y + 0.5;

            const p = new PixelData();
            p.initFromTriangleEquation(eqn, xf, yf);

            while (x < x2) {
                p.x = x;
                this.drawPixel(p);
                p.stepX(eqn);
                ++x;
            }
        }
    }

    export class ColoredPixelShader extends PixelShader {
        drawPixel(p: PixelData) {
            const c = p.props[0] | 0;
            screen.setPixel(p.x | 0, p.y | 0, c);
        }
    }

    export class TexturedPixelShader extends PixelShader {
        texture: Image;
        // todo: add texture wrapping modes
        drawPixel(p: PixelData) {
            const u = p.props[0];
            const v = p.props[1];
            screen.setPixel(p.x | 0, p.y | 0, 8); // todo, lookup pixel color in texture
        }
    }

    export class Rasterizer {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
        shader: PixelShader;

        constructor() {
            this.setScissorRect(0, 0, 0, 0);
        }

        setScissorRect(minX: number, minY: number, maxX: number, maxY: number) {
            this.minX = minX;
            this.minY = minY;
            this.maxX = maxX;
            this.maxY = maxY;
        }

        setPixelShader(shader: PixelShader) {
            this.shader = shader;
        }

        scissorTest(x: number, y: number): boolean {
            return (x >= this.minX && x < this.maxX && y >= this.minY && y < this.maxY);
        }

        drawPoint(cmd: DrawPointCommand) {
            const v = cmd.v;

            if (!this.scissorTest(v.x, v.y))
                return;

            const p = this.pixelDataFromVertex(v);
            this.shader.drawPixel(p);
        }

        drawLine(cmd: DrawLineCommand) {
            const v0 = cmd.v0;
            const v1 = cmd.v1;
            const adx = Math.abs(v1.x - v0.x) | 0;
            const ady = Math.abs(v1.y - v0.y) | 0;
            let steps = Math.max(adx, ady);
            const step = this.computeVertexStep(v0, v1, steps);
            const v = v0;
            while (steps-- > 0) {
                const p = this.pixelDataFromVertex(v);
                if (this.scissorTest(p.x, p.y))
                    this.shader.drawPixel(p);
                this.stepVertex(v, step);
            }
        }

        drawTriangle(cmd: DrawTriangleCommand) {
            this.drawTriangleSpan(cmd.v0, cmd.v1, cmd.v2);
        }

        private drawTriangleSpan(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const eqn = new TriangleEquation(v0, v1, v2);

            // If triangle is backfacing, return (maybe not desired in 2d world)
            if (eqn.area2 <= 0) return;

            let t: RasterizerVertex = v0;
            let m: RasterizerVertex = v1;
            let b: RasterizerVertex = v2;

            // Sort verts from top to bottom
            if (t.y > m.y) {
                const tmp = t;
                t = m;
                m = tmp;
            }
            if (m.y > b.y) {
                const tmp = m;
                m = b;
                b = tmp;
            }
            if (t.y > m.y) {
                const tmp = t;
                t = m;
                m = tmp;
            }

            const dy = (b.y - t.y);
            const iy = (m.y - t.y);

            if (m.y === t.y) {
                let l = m;
                let r = t;
                if (l.x > r.x) {
                    const t = l;
                    l = r;
                    r = t;
                }
                this.drawTopFlatTriangle(eqn, l, r, b);
            } else if (m.y === b.y) {
                let l = m;
                let r = b;
                if (l.x > r.x) {
                    const t = l;
                    l = r;
                    r = t;
                }
                this.drawBottomFlatTriangle(eqn, t, l, r);
            } else {
                const v4 = new RasterizerVertex();
                v4.y = m.y;
                v4.x = t.x + ((b.x - t.x) / dy) * iy;
                for (let i = 0; i < v0.props.length; ++i)
                    v4.props.push(t.props[i] + ((b.props[i] - t.props[i]) / dy) * iy);

                let l = m;
                let r = v4;
                if (l.x > r.x) {
                    const t = l;
                    l = r;
                    r = t;
                }

                this.drawBottomFlatTriangle(eqn, t, l, r);
                this.drawTopFlatTriangle(eqn, l, r, b);
            }
        }

        private drawTopFlatTriangle(eqn: TriangleEquation, v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const invslope1 = (v2.x - v0.x) / (v2.y - v0.y);
            const invslope2 = (v2.x - v1.x) / (v2.y - v1.y);

            for (let scanlineY = (v2.y - 0.5) | 0; scanlineY > ((v0.y - 0.5) | 0); --scanlineY) {
                const dy = (scanlineY - v2.y) + 0.5;
                const curx1 = v2.x + invslope1 * dy + 0.5;
                const curx2 = v2.x + invslope2 * dy + 0.5;
                const xl = Math.max(this.minX, curx1 | 0);
                const xr = Math.min(this.maxX, curx2 | 0);
                this.shader.drawSpan(eqn, xl, scanlineY, xr);
            }
        }

        private drawBottomFlatTriangle(eqn: TriangleEquation, v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const invslope1 = (v1.x - v0.x) / (v1.y - v0.y);
            const invslope2 = (v2.x - v0.x) / (v2.y - v0.y);

            for (let scanlineY = (v0.y + 0.5) | 0; scanlineY < ((v1.y + 0.5) | 0); ++scanlineY) {
                const dy = (scanlineY - v0.y) + 0.5;
                const curx1 = v0.x + invslope1 * dy + 0.5;
                const curx2 = v0.x + invslope2 * dy + 0.5;
                const xl = Math.max(this.minX, curx1 | 0);
                const xr = Math.min(this.maxX, curx2 | 0);
                this.shader.drawSpan(eqn, xl, scanlineY, xr);
            }
        }

        private pixelDataFromVertex(v: RasterizerVertex): PixelData {
            const p = new PixelData();
            p.initFromVertex(v);
            return p;
        }

        private stepVertex(v: RasterizerVertex, step: RasterizerVertex) {
            v.x += step.x;
            v.y += step.y;
            for (let i = 0; i < v.props.length; ++i)
                v.props[i] += step.props[i];
        }

        private computeVertexStep(v0: RasterizerVertex, v1: RasterizerVertex, adx: number): RasterizerVertex {
            const step = new RasterizerVertex();
            step.x = (v1.x - v0.x) / adx;
            step.y = (v1.y - v0.y) / adx;
            step.props.length = v0.props.length;
            for (let i = 0; i < v0.props.length; ++i)
                step.props[i] = (v1.props[i] - v0.props[i]) / adx;
            return step;
        }
    }

    export class Renderer {
        cmds: DrawCommand[];
        rasterizer: Rasterizer;

        constructor() {
            this.cmds = [];
            this.rasterizer = new Rasterizer();
        }

        queueDrawCommand(cmd: DrawCommand) {
            this.cmds.push(cmd);
        }

        render() {
            for (let i = 0; i < this.cmds.length; ++i) {
                const cmd = this.cmds[i];
                cmd.prepare(this.rasterizer);
                cmd.draw(this.rasterizer);
            }
            this.cmds = [];
        }
    }
}
