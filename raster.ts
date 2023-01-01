namespace contraption {
    export interface Resettable {
        reset(): void;
    }

    export class ObjectPool<T extends Resettable> {
        private pool: T[] = [];

        constructor(private factory: () => T) { }

        alloc(): T {
            if (this.pool.length) {
                return this.pool.pop();
            }
            return this.factory();
        }

        free(obj: T) {
            obj.reset();
            this.pool.push(obj);
        }
    }

    export class RasterizerVertex {
        x: Fx8;
        y: Fx8;
        props: Fx8[]; // interpolated vertex properties (tex coords, for example)

        constructor() {
            this.props = [];
        }
    }
    
    export class DrawCommand {
        shader: PixelShader;
        constructor(shader: PixelShader) {
            this.shader = shader;
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
    export class EdgeEquation implements Resettable {
        static Pool = new ObjectPool<EdgeEquation>(() => new EdgeEquation());

        a: Fx8;
        b: Fx8;
        c: Fx8;
        tie: boolean;

        init(v0: RasterizerVertex, v1: RasterizerVertex) {
            this.a = Fx.sub(v0.y, v1.y);
            this.b = Fx.sub(v1.x, v0.x);
            this.c =
                Fx.div(
                    Fx.neg(
                        Fx.add(
                            Fx.mul(
                                this.a,
                                Fx.add(v0.x, v1.x)),
                            Fx.mul(
                                this.b,
                                Fx.add(v0.y, v1.y)))),
                        Fx.twoFx8);
        }

        reset() {}

        evaluate(x: Fx8, y: Fx8): Fx8 {
            return Fx.add(Fx.add(Fx.mul(this.a, x), Fx.mul(this.b, y)), this.c);
        }

        testPoint(x: Fx8, y: Fx8): boolean {
            return this.testValue(this.evaluate(x, y));
        }

        testValue(v: Fx8): boolean {
            return (v > Fx.zeroFx8 || (v === Fx.zeroFx8 && this.tie));
        }

        stepX(v: Fx8): Fx8 {
            return Fx.add(v, this.a);
        }

        stepXScaled(v: Fx8, step: Fx8): Fx8 {
            return Fx.add(v, Fx.mul(this.a, step));
        }

        stepY(v: Fx8): Fx8 {
            return Fx.add(v, this.b);
        }

        stepYScaled(v: Fx8, step: Fx8): Fx8 {
            return Fx.mul(v, Fx.mul(this.b, step));
        }
    }

    // Same as EdgeEquation, just initialized differently for parameter interpolations (tex coords, for example)
    export class ParameterEquation implements Resettable {
        static Pool = new ObjectPool<ParameterEquation>(() => new ParameterEquation());
        a: Fx8;
        b: Fx8;
        c: Fx8;

        init(p0: Fx8, p1: Fx8, p2: Fx8, e0: EdgeEquation, e1: EdgeEquation, e2: EdgeEquation, factor: Fx8) {
            this.a = Fx.mul(factor, (Fx.add(Fx.add(Fx.mul(p0, e0.a), Fx.mul(p1, e1.a)), Fx.mul(p2, e2.a))));
            this.b = Fx.mul(factor, (Fx.add(Fx.add(Fx.mul(p0, e0.b), Fx.mul(p1, e1.b)), Fx.mul(p2, e2.b))));
            this.c = Fx.mul(factor, (Fx.add(Fx.add(Fx.mul(p0, e0.c), Fx.mul(p1, e1.c)), Fx.mul(p2, e2.c))));
        }

        reset() { }

        evaluate(x: Fx8, y: Fx8): Fx8 {
            return Fx.add(Fx.add(Fx.mul(this.a, x), Fx.mul(this.b, y)), this.c);
        }

        stepX(v: Fx8): Fx8 {
            return Fx.add(v, this.a);
        }

        stepXScaled(v: Fx8, step: Fx8): Fx8 {
            return Fx.add(v, Fx.mul(this.a, step));
        }

        stepY(v: Fx8): Fx8 {
            return Fx.add(v, this.b);
        }

        stepYScaled(v: Fx8, step: Fx8): Fx8 {
            return Fx.mul(v, Fx.mul(this.b, step));
        }
    }

    export class TriangleEquation implements Resettable {
        static Pool = new ObjectPool<TriangleEquation>(() => new TriangleEquation());

        area2: Fx8;
        e0: EdgeEquation;
        e1: EdgeEquation;
        e2: EdgeEquation;
        props: ParameterEquation[];

        init(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            this.e0 = EdgeEquation.Pool.alloc(); this.e0.init(v1, v2);
            this.e1 = EdgeEquation.Pool.alloc(); this.e1.init(v2, v0);
            this.e2 = EdgeEquation.Pool.alloc(); this.e2.init(v0, v1);

            this.area2 = Fx.add(this.e0.c,Fx.add(this.e1.c, this.e2.c));
            if (this.area2 <= Fx.zeroFx8) return;

            const factor = Fx.div(Fx.oneFx8, this.area2);

            if (!this.props)
                this.props = [];
            for (let i = 0; i < v0.props.length; ++i) {
                const prop = ParameterEquation.Pool.alloc();
                prop.init(v0.props[i], v1.props[i], v2.props[i], this.e0, this.e1, this.e2, factor)
                this.props.push(prop);
            }
        }

        reset() {
            EdgeEquation.Pool.free(this.e0);
            EdgeEquation.Pool.free(this.e1);
            EdgeEquation.Pool.free(this.e2);
            for (let i = 0; i < this.props.length; ++i)
                ParameterEquation.Pool.free(this.props[i]);
            this.props = [];
        }
    }

    export class PixelData implements Resettable {
        static Pool = new ObjectPool<PixelData>(() => new PixelData());
        x: Fx8;
        y: Fx8;
        props: Fx8[];

        reset() { }

        initFromVertex(v: RasterizerVertex) {
            this.props = [];
            this.x = v.x;
            this.y = v.y;
            for (let i = 0; i < v.props.length; ++i)
                this.props.push(v.props[i]);
        }

        initFromTriangleEquation(eqn: TriangleEquation, x: Fx8, y: Fx8) {
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
        drawSpan(eqn: TriangleEquation, x: Fx8, y: Fx8, x2: Fx8) {
            const xf = Fx.add(x, Fx.oneHalfFx8);
            const yf = Fx.add(y, Fx.oneHalfFx8);

            const p = PixelData.Pool.alloc();
            p.initFromTriangleEquation(eqn, xf, yf);
            p.y = y;

            while (x < x2) {
                p.x = x;
                this.drawPixel(p);
                p.stepX(eqn);
                x = Fx.add(x, Fx.oneFx8);
            }

            PixelData.Pool.free(p);
        }
    }

    export class ColoredPixelShader extends PixelShader {
        drawPixel(p: PixelData) {
            const c = Fx.toInt(p.props[0]);
            if (c) {
                screen.setPixel(Fx.toInt(p.x), Fx.toInt(p.y), c);
            }
        }
    }

    export class TexturedPixelShader extends PixelShader {
        texture: Image;
        // todo: add texture wrapping modes
        drawPixel(p: PixelData) {
            const u = Fx.toInt(p.props[0]);
            const v = Fx.toInt(p.props[1]);
            const tx = Math.abs((this.texture.width * u) % this.texture.width);
            const ty = Math.abs((this.texture.height * v) % this.texture.height);
            const c = this.texture.getPixel(tx, ty);
            //if (c) {
                screen.setPixel(Fx.toInt(p.x), Fx.toInt(p.y), 8);
            //}
        }
    }

    export class Rasterizer {
        minX: Fx8;
        minY: Fx8;
        maxX: Fx8;
        maxY: Fx8;
        shader: PixelShader;

        constructor() {
            this.setScissorRect(0, 0, 0, 0);
        }

        setScissorRect(minX: number, minY: number, maxX: number, maxY: number) {
            this.minX = Fx8(minX);
            this.minY = Fx8(minY);
            this.maxX = Fx8(maxX);
            this.maxY = Fx8(maxY);
        }

        setPixelShader(shader: PixelShader) {
            this.shader = shader;
        }

        scissorTest(x: Fx8, y: Fx8): boolean {
            return (x >= this.minX && x < this.maxX && y >= this.minY && y < this.maxY);
        }

        drawPoint(cmd: DrawPointCommand) {
            const v = cmd.v;

            if (!this.scissorTest(v.x, v.y))
                return;

            const p = this.pixelDataFromVertex(v);
            this.shader.drawPixel(p);
            PixelData.Pool.free(p);
        }

        drawLine(cmd: DrawLineCommand) {
            const v0 = cmd.v0;
            const v1 = cmd.v1;
            const adx = Fx.floor(Fx.abs(Fx.sub(v1.x, v0.x)));
            const ady = Fx.floor(Fx.abs(Fx.sub(v1.y, v0.y)));
            let steps = Fx.max(adx, ady);
            const step = this.computeVertexStep(v0, v1, steps);
            const v = v0;
            while (steps > Fx.zeroFx8) {
                steps = Fx.sub(steps, Fx.oneFx8);
                const p = this.pixelDataFromVertex(v);
                if (this.scissorTest(p.x, p.y))
                    this.shader.drawPixel(p);
                this.stepVertex(v, step);
                PixelData.Pool.free(p);
            }
        }

        drawTriangle(cmd: DrawTriangleCommand) {
            this.drawTriangleSpan(cmd.v0, cmd.v1, cmd.v2);
        }

        private drawTriangleSpan(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const eqn = TriangleEquation.Pool.alloc(); eqn.init(v0, v1, v2);

            // If triangle is backfacing, return (maybe not desired in 2d world)
            if (eqn.area2 <= Fx.zeroFx8) return;

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

            if (m.y === t.y) {
                let l = m;
                let r = t;
                if (l.x > r.x) {
                    const tmp = l;
                    l = r;
                    r = tmp;
                }
                this.drawTopFlatTriangle(eqn, l, r, b);
            } else if (m.y === b.y) {
                let l = m;
                let r = b;
                if (l.x > r.x) {
                    const tmp = l;
                    l = r;
                    r = tmp;
                }
                this.drawBottomFlatTriangle(eqn, t, l, r);
            } else {
                const dy = Fx.sub(b.y, t.y);
                const iy = Fx.sub(m.y, t.y);
                const v4 = new RasterizerVertex();
                v4.y = m.y;
                v4.x = Fx.add(t.x, Fx.mul(Fx.div(Fx.sub(b.x, t.x), dy), iy));
                for (let i = 0; i < v0.props.length; ++i)
                    v4.props.push(Fx.add(t.props[i], Fx.mul(Fx.div(Fx.sub(b.props[i], t.props[i]), dy), iy)));

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
            TriangleEquation.Pool.free(eqn);
        }

        private drawTopFlatTriangle(eqn: TriangleEquation, v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const invslope1 = Fx.div(Fx.sub(v2.x, v0.x), Fx.sub(v2.y, v0.y));
            const invslope2 = Fx.div(Fx.sub(v2.x, v1.x), Fx.sub(v2.y, v1.y));

            for (let scanlineY = Fx.floor(Fx.sub(v2.y, Fx.oneHalfFx8)); scanlineY > Fx.floor(Fx.sub(v0.y, Fx.oneHalfFx8)); scanlineY = Fx.sub(scanlineY, Fx.oneFx8)) {
                const dy = Fx.add(Fx.sub(scanlineY, v2.y), Fx.oneHalfFx8);
                const curx1 = Fx.add(v2.x, Fx.add(Fx.mul(invslope1, dy), Fx.oneHalfFx8));
                const curx2 = Fx.add(v2.x, Fx.add(Fx.mul(invslope2, dy), Fx.oneHalfFx8));
                const xl = Fx.max(this.minX, Fx.floor(curx1));
                const xr = Fx.min(this.maxX, Fx.floor(curx2));
                this.shader.drawSpan(eqn, xl, scanlineY, xr);
            }
        }

        private drawBottomFlatTriangle(eqn: TriangleEquation, v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const invslope1 = Fx.div(Fx.sub(v1.x, v0.x), Fx.sub(v1.y, v0.y));
            const invslope2 = Fx.div(Fx.sub(v2.x, v0.x), Fx.sub(v2.y, v0.y));

            for (let scanlineY = Fx.floor(Fx.add(v0.y, Fx.oneHalfFx8)); scanlineY < Fx.floor(Fx.add(v1.y, Fx.oneHalfFx8)); scanlineY = Fx.add(scanlineY, Fx.oneFx8)) {
                const dy = Fx.add(Fx.sub(scanlineY, v0.y), Fx.oneHalfFx8);
                const curx1 = Fx.add(v0.x, Fx.add(Fx.mul(invslope1, dy), Fx.oneHalfFx8));
                const curx2 = Fx.add(v0.x, Fx.add(Fx.mul(invslope2, dy), Fx.oneHalfFx8));
                const xl = Fx.max(this.minX, Fx.floor(curx1));
                const xr = Fx.min(this.maxX, Fx.floor(curx2));
                this.shader.drawSpan(eqn, xl, scanlineY, xr);
            }
        }

        private pixelDataFromVertex(v: RasterizerVertex): PixelData {
            const p = PixelData.Pool.alloc();
            p.initFromVertex(v);
            return p;
        }

        private stepVertex(v: RasterizerVertex, step: RasterizerVertex) {
            v.x = Fx.add(v.x, step.x);
            v.y = Fx.add(v.y, step.y);
            for (let i = 0; i < v.props.length; ++i)
                v.props[i] = Fx.add(v.props[i], step.props[i]);
        }

        private computeVertexStep(v0: RasterizerVertex, v1: RasterizerVertex, adx: Fx8): RasterizerVertex {
            const step = new RasterizerVertex();
            step.x = Fx.div(Fx.sub(v1.x, v0.x), adx);
            step.y = Fx.div(Fx.sub(v1.y, v0.y), adx);
            step.props.length = v0.props.length;
            for (let i = 0; i < v0.props.length; ++i)
                step.props[i] = Fx.div(Fx.sub(v1.props[i], v0.props[i]), adx);
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
                this.rasterizer.setPixelShader(cmd.shader);
                cmd.draw(this.rasterizer);
            }
            this.cmds = [];
        }
    }
}
