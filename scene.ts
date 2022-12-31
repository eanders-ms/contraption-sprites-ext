namespace contraption {

    const UPDATE_INPUT_PRIORITY = 10;
    const UPDATE_SPRITES_PRIORITY = 20;
    const TICK_PHYSICS_PRIORITY = 30;
    const RENDER_SPRITES_PRIORITY = 40;
    const RASTERIZER_PRIORITY = 50;
    const RENDER_DIAGNOSTICS_PRIORITY = 190;
    const UPDATE_SCREEN_PRIORITY = 200;
    
    export class Scene {
        static scenes_: Scene[] = [];
        static stats = false;

        static pushScene(scene?: Scene): Scene {
            if (!scene) scene = new Scene();
            Scene.scenes_.push(scene);
            scene.start();
            return scene;
        }

        static popScene(): Scene {
            const scene = Scene.scenes_.pop();
            scene.stop();
            return scene;
        }

        backgroundColor: number;
        engine: Engine;
        runner: Runner;
        sprites: Sprite[];
        camera: Camera;
        renderer: Renderer;

        constructor(engine?: Engine, runner?: Runner) {
            if (!runner) runner = new Runner();
            if (!engine) engine = new Engine()
            this.engine = engine;
            this.runner = runner;
            this.camera = new Camera();
            this.renderer = new Renderer();
            this.renderer.rasterizer.setScissorRect(0, 0, screen.width, screen.height);
            this.sprites = [];
            this.backgroundColor = 0;
        }

        start(): void {
            const ev = control.pushEventContext();
            ev.registerFrameHandler(UPDATE_INPUT_PRIORITY, () => this.input());
            ev.registerFrameHandler(UPDATE_SPRITES_PRIORITY, () => this.updateSprites());
            ev.registerFrameHandler(TICK_PHYSICS_PRIORITY, () => this.tickPhysics());
            ev.registerFrameHandler(RENDER_SPRITES_PRIORITY, () => this.renderSprites());
            ev.registerFrameHandler(RASTERIZER_PRIORITY, () => this.rasterize());
            ev.registerFrameHandler(RENDER_DIAGNOSTICS_PRIORITY, () => this.renderDiags());
            ev.registerFrameHandler(UPDATE_SCREEN_PRIORITY, control.__screen.update);
        }

        stop(): void {
            control.popEventContext();
        }

        private input(): void {
            controller.__update(control.eventContext().deltaTime);
        }

        private tickPhysics(): void {
            this.runner.tick(this.engine);
        }

        private updateSprites(): void {
            for (let i = 0; i < this.sprites.length; ++i) {
                const sprite = this.sprites[i];
                sprite.update();
            }
        }

        private renderSprites(): void {
            screen.fill(this.backgroundColor);
            for (let i = 0; i < this.sprites.length; ++i) {
                const sprite = this.sprites[i];
                sprite.render();
            }
        }

        private rasterize(): void {
            this.renderer.render();
        }

        private renderDiags(): void {
            if (Scene.stats && control.EventContext.onStats) {
                control.EventContext.onStats(
                    control.EventContext.lastStats +
                    ` sprites:${this.sprites.length}` +
                    ` physics:${(this.engine.timing.lastElapsed * 1000) | 0}ms`
                );
            }
        }

        addSprite(sprite: Sprite): this {
            sprite.scene = this;
            this.sprites.push(sprite);
            this.engine.world.addBody(sprite.body);
            return this;
        }

        removeSprite(sprite: Sprite): this {
            this.engine.world.removeBody(sprite.body);
            this.sprites = this.sprites.filter(s => s.id === sprite.id);
            sprite.scene = undefined;
            return this;
        }
    }
}
