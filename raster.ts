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

    export class RasterizerVertex extends Vector {
        props: number[]; // interpolated vertex properties (tex coords, for example)

        constructor() {
            super();
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

        a: number;
        b: number;
        c: number;
        tie: boolean;

        init(v0: RasterizerVertex, v1: RasterizerVertex) {
            this.a = v0.y - v1.y;
            this.b = v1.x - v0.x;
            this.c = -(this.a * (v0.x + v1.x) + this.b * (v0.y + v1.y)) / 2;
        }

        reset() { }

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
    export class ParameterEquation implements Resettable {
        static Pool = new ObjectPool<ParameterEquation>(() => new ParameterEquation());
        a: number;
        b: number;
        c: number;

        init(p0: number, p1: number, p2: number, e0: EdgeEquation, e1: EdgeEquation, e2: EdgeEquation, factor: number) {
            this.a = factor * (p0 * e0.a + p1 * e1.a + p2 * e2.a);
            this.b = factor * (p0 * e0.b + p1 * e1.b + p2 * e2.b);
            this.c = factor * (p0 * e0.c + p1 * e1.c + p2 * e2.c);
        }

        reset() { }

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

    export class TriangleEquation implements Resettable {
        static Pool = new ObjectPool<TriangleEquation>(() => new TriangleEquation());

        area2: number;
        e0: EdgeEquation;
        e1: EdgeEquation;
        e2: EdgeEquation;
        props: ParameterEquation[];

        init(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            this.e0 = EdgeEquation.Pool.alloc(); this.e0.init(v1, v2);
            this.e1 = EdgeEquation.Pool.alloc(); this.e1.init(v2, v0);
            this.e2 = EdgeEquation.Pool.alloc(); this.e2.init(v0, v1);

            this.area2 = this.e0.c + this.e1.c + this.e2.c;
            if (this.area2 <= 0) return;

            const factor = 1.0 / this.area2;

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
        x: number;
        y: number;
        props: number[];

        reset() { }

        copyFrom(other: PixelData) {
            this.x = other.x;
            this.y = other.y;
            this.props = [];
            for (let i = 0; i < other.props.length; ++i)
                this.props.push(other.props[i]);
        }

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

        stepY(eqn: TriangleEquation) {
            for (let i = 0; i < eqn.props.length; ++i)
                this.props[i] = eqn.props[i].stepY(this.props[i]);
        }
    }

    export class EdgeData implements Resettable {
        static Pool = new ObjectPool<EdgeData>(() => new EdgeData());
        ev0: number;
        ev1: number;
        ev2: number;

        init(eqn: TriangleEquation, x: number, y: number) {
            this.ev0 = eqn.e0.evaluate(x, y);
            this.ev1 = eqn.e1.evaluate(x, y);
            this.ev2 = eqn.e2.evaluate(x, y);
        }

        reset() { }

        copyFrom(other: EdgeData) {
            this.ev0 = other.ev0;
            this.ev1 = other.ev1;
            this.ev2 = other.ev2;
        }

        stepX(eqn: TriangleEquation) {
            this.ev0 = eqn.e0.stepX(this.ev0);
            this.ev1 = eqn.e1.stepX(this.ev1);
            this.ev2 = eqn.e2.stepX(this.ev2);
        }

        stepXScaled(eqn: TriangleEquation, stepSize: number) {
            this.ev0 = eqn.e0.stepXScaled(this.ev0, stepSize);
            this.ev1 = eqn.e1.stepXScaled(this.ev1, stepSize);
            this.ev2 = eqn.e2.stepXScaled(this.ev2, stepSize);
        }

        stepY(eqn: TriangleEquation) {
            this.ev0 = eqn.e0.stepY(this.ev0);
            this.ev1 = eqn.e1.stepY(this.ev1);
            this.ev2 = eqn.e2.stepY(this.ev2);
        }

        stepYScaled(eqn: TriangleEquation, stepSize: number) {
            this.ev0 = eqn.e0.stepYScaled(this.ev0, stepSize);
            this.ev1 = eqn.e1.stepYScaled(this.ev1, stepSize);
            this.ev2 = eqn.e2.stepYScaled(this.ev2, stepSize);
        }

        test(eqn: TriangleEquation) {
            return eqn.e0.testValue(this.ev0) && eqn.e1.testValue(this.ev1) && eqn.e2.testValue(this.ev2);
        }
    }

    export class PixelShader {
        drawPixel(p: PixelData) {
            // overridden
        }
        drawSpan(eqn: TriangleEquation, x: number, y: number, x2: number) {
            const xf = x + 0.5;
            const yf = y + 0.5;

            const p = PixelData.Pool.alloc();
            p.initFromTriangleEquation(eqn, xf, yf);
            p.y = y;

            while (x < x2) {
                p.x = x;
                this.drawPixel(p);
                p.stepX(eqn);
                ++x;
            }

            PixelData.Pool.free(p);
        }
        drawBlock(eqn: TriangleEquation, x: number, y: number, testEdges: boolean) {
            const xf = x + 0.5;
            const yf = y + 0.5;

            const po = PixelData.Pool.alloc();
            po.initFromTriangleEquation(eqn, xf, yf);

            const eo = EdgeData.Pool.alloc();
            if (testEdges)
                eo.init(eqn, xf, yf);

            for (let yy = y; yy < y + BLOCK_SIZE; ++yy) {
                const pi = PixelData.Pool.alloc();
                pi.copyFrom(po);

                const ei = EdgeData.Pool.alloc();
                if (testEdges)
                    ei.copyFrom(eo);

                for (let xx = x; xx < x + BLOCK_SIZE; ++xx) {
                    if (!testEdges || ei.test(eqn)) {
                        pi.x = xx;
                        pi.y = yy;
                        this.drawPixel(pi);
                    }

                    pi.stepX(eqn);
                    if (testEdges)
                        ei.stepX(eqn);
                }

                po.stepY(eqn);
                if (testEdges)
                    eo.stepY(eqn);
            }
        }
    }

    export class ColoredPixelShader extends PixelShader {
        drawPixel(p: PixelData) {
            const c = p.props[0] | 0;
            if (c) {
                screen.setPixel(p.x | 0, p.y | 0, c);
            }
        }
    }

    export class TexturedPixelShader extends PixelShader {
        texture: Image;
        // todo: add texture wrapping modes
        drawPixel(p: PixelData) {
            const u = p.props[0];
            const v = p.props[1];
            const tx = Math.abs((this.texture.width * u) % this.texture.width) | 0;
            const ty = Math.abs((this.texture.height * v) % this.texture.height) | 0;
            const c = this.texture.getPixel(tx, ty);
            if (c) {
                screen.setPixel(p.x | 0, p.y | 0, c);
            }
        }
    }

    const BLOCK_SIZE = 8;

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
            PixelData.Pool.free(p);
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
                PixelData.Pool.free(p);
            }
        }

        drawTriangle(cmd: DrawTriangleCommand) {
            this.drawTriangleSpan(cmd.v0, cmd.v1, cmd.v2);
            //this.drawTriangleBlock(cmd.v0, cmd.v1, cmd.v2);
        }

        private drawTriangleBlock(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const eqn = TriangleEquation.Pool.alloc(); eqn.init(v0, v1, v2);

            // If triangle is backfacing, return (maybe not desired in 2d world)
            if (eqn.area2 <= 0) {
                TriangleEquation.Pool.free(eqn);
                return;
            }

            // Compute triangle bounding box.
            let minX = Math.min(Math.min(v0.x, v1.x), v2.x) | 0;
            let maxX = Math.max(Math.max(v0.x, v1.x), v2.x) | 0;
            let minY = Math.min(Math.min(v0.y, v1.y), v2.y) | 0;
            let maxY = Math.max(Math.max(v0.y, v1.y), v2.y) | 0;

            // Clip to scissor rect.
            minX = Math.max(minX, this.minX);
            maxX = Math.min(maxX, this.maxX);
            minY = Math.max(minY, this.minY);
            maxY = Math.min(maxY, this.maxY);

            // Round to block grid.
            minX = minX & ~(BLOCK_SIZE - 1);
            maxX = maxX & ~(BLOCK_SIZE - 1);
            minY = minY & ~(BLOCK_SIZE - 1);
            maxY = maxY & ~(BLOCK_SIZE - 1);

            const s = BLOCK_SIZE - 1;

            const stepsX = (maxX - minX) / BLOCK_SIZE + 1;
            const stepsY = (maxY - minY) / BLOCK_SIZE + 1;

            for (let i = 0; i < stepsX * stepsY; ++i) {
                const sx = i % stepsX;
                const sy = i / stepsX;

                // Add 0.5 to sample at pixel centers.
                const x = minX + sx * BLOCK_SIZE;
                const y = minY + sy * BLOCK_SIZE;

                const xf = x + 0.5;
                const yf = y + 0.5;

                // Test if block is inside or outside triangle or touches it.
                const e00 = EdgeData.Pool.alloc(); e00.init(eqn, xf, yf);
                const e01 = EdgeData.Pool.alloc(); e01.copyFrom(e00); e01.stepYScaled(eqn, s);
                const e10 = EdgeData.Pool.alloc(); e10.copyFrom(e00); e10.stepXScaled(eqn, s);
                const e11 = EdgeData.Pool.alloc(); e11.copyFrom(e01); e11.stepXScaled(eqn, s);

                const e00_0 = eqn.e0.testValue(e00.ev0), e00_1 = eqn.e1.testValue(e00.ev1), e00_2 = eqn.e2.testValue(e00.ev2), e00_all = (e00_0 && e00_1 && e00_2) ? 1 : 0;
                const e01_0 = eqn.e0.testValue(e01.ev0), e01_1 = eqn.e1.testValue(e01.ev1), e01_2 = eqn.e2.testValue(e01.ev2), e01_all = (e01_0 && e01_1 && e01_2) ? 1 : 0;
                const e10_0 = eqn.e0.testValue(e10.ev0), e10_1 = eqn.e1.testValue(e10.ev1), e10_2 = eqn.e2.testValue(e10.ev2), e10_all = (e10_0 && e10_1 && e10_2) ? 1 : 0;
                const e11_0 = eqn.e0.testValue(e11.ev0), e11_1 = eqn.e1.testValue(e11.ev1), e11_2 = eqn.e2.testValue(e11.ev2), e11_all = (e11_0 && e11_1 && e11_2) ? 1 : 0;

                const result = e00_all + e01_all + e10_all + e11_all;

                // Potentially all out.
                if (result == 0) {
                    // Test for special case.
                    const e00Same = e00_0 == e00_1 == e00_2;
                    const e01Same = e01_0 == e01_1 == e01_2;
                    const e10Same = e10_0 == e10_1 == e10_2;
                    const e11Same = e11_0 == e11_1 == e11_2;

                    if (!e00Same || !e01Same || !e10Same || !e11Same)
                        this.shader.drawBlock(eqn, x, y, true);
                } else if (result == 4) {
                    // Fully Covered.
                    this.shader.drawBlock(eqn, x, y, false);
                } else {
                    // Partially Covered.
                    this.shader.drawBlock(eqn, x, y, true);
                }
            }

            TriangleEquation.Pool.free(eqn);
        }

        private drawTriangleSpan(v0: RasterizerVertex, v1: RasterizerVertex, v2: RasterizerVertex) {
            const eqn = TriangleEquation.Pool.alloc(); eqn.init(v0, v1, v2);

            // If triangle is backfacing, return (maybe not desired in 2d world)
            if (eqn.area2 <= 0) {
                TriangleEquation.Pool.free(eqn);
                return;
            }

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
                const dy = (b.y - t.y);
                const iy = (m.y - t.y);
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

            TriangleEquation.Pool.free(eqn);
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
            const p = PixelData.Pool.alloc();
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
                this.rasterizer.setPixelShader(cmd.shader);
                cmd.draw(this.rasterizer);
            }
            this.cmds = [];
        }
    }
}
