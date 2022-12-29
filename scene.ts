namespace contraption {
    const INPUT_PRIORITY = 5;
    const UPDATE_SPRITES_PRIORITY = 10;
    const PHYSICS_PRIORITY = 15;
    const RENDER_SPRITES_PRIORITY = 25;
    const UPDATE_SCREEN_PRIORITY = 200;
    
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
        world: World;
        engine: Engine;
        runner: Runner;
        sprites: Sprite[];
        camera: Camera;

        constructor(world?: World, engine?: Engine, runner?: Runner) {
            if (!runner) runner = new Runner();
            if (!world) world = new World();
            if (!engine) engine = new Engine({ world })
            this.world = world;
            this.engine = engine;
            this.runner = runner;
            this.camera = new Camera();
            this.sprites = [];
            this.backgroundColor = 0;
        }

        start(): void {
            const ev = control.pushEventContext();
            ev.registerFrameHandler(INPUT_PRIORITY, () => this.input());
            ev.registerFrameHandler(UPDATE_SPRITES_PRIORITY, () => this.update());
            ev.registerFrameHandler(PHYSICS_PRIORITY, () => this.runner.tick(this.engine));
            ev.registerFrameHandler(RENDER_SPRITES_PRIORITY, () => this.render());
            ev.registerFrameHandler(UPDATE_SCREEN_PRIORITY, () => {});
        }

        stop(): void {
            control.popEventContext();
        }

        private input(): void {
            controller.__update(control.eventContext().deltaTime);
        }

        private update(): void {
            for (let i = 0; i < this.sprites.length; ++i) {
                const sprite = this.sprites[i];
                sprite.update();
            }
        }

        private render(): void {
            screen.fill(this.backgroundColor);
            for (let i = 0; i < this.sprites.length; ++i) {
                const sprite = this.sprites[i];
                sprite.render();
            }
        }

        addSprite(sprite: Sprite): this {
            sprite.scene = this;
            this.sprites.push(sprite);
            return this;
        }

        removeSprite(sprite: Sprite): this {
            this.sprites = this.sprites.filter(s => s.id === sprite.id);
            sprite.scene = undefined;
            return this;
        }
    }
}
