namespace contraption {

    const UPDATE_INPUT_PRIORITY = 10;
    const UPDATE_SPRITES_PRIORITY = 20;
    const TICK_PHYSICS_PRIORITY = 30;
    const RENDER_SPRITES_PRIORITY = 90;
    
    export class Scene {
        static scenes_: Scene[] = [];

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

        constructor(engine?: Engine, runner?: Runner) {
            if (!runner) runner = new Runner();
            if (!engine) engine = new Engine()
            this.engine = engine;
            this.runner = runner;
            this.camera = new Camera();
            this.sprites = [];
            this.backgroundColor = 0;
        }

        start(): void {
            //control.pushEventContext(); // TODO: Why is perf horrible after pushEventContext?
            const ev = control.eventContext();
            ev.registerFrameHandler(UPDATE_INPUT_PRIORITY, () => this.input());
            ev.registerFrameHandler(UPDATE_SPRITES_PRIORITY, () => this.updateSprites());
            ev.registerFrameHandler(TICK_PHYSICS_PRIORITY, () => this.tickPhysics());
            ev.registerFrameHandler(RENDER_SPRITES_PRIORITY, () => this.renderSprites());
        }

        stop(): void {
            //control.popEventContext();
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
