import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Vector2 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import {HemisphericLight} from "@babylonjs/core/Lights/hemisphericLight";
import { Mesh } from "@babylonjs/core/Meshes";
import { StandardMaterial } from "@babylonjs/core/Materials";
import { Texture, CubeTexture } from "@babylonjs/core/Materials/Textures";
import "@babylonjs/core/Materials/standardMaterial";
import { WaterMaterial } from "@babylonjs/materials/water";
// Required side effects to populate the Create methods on the mesh class. Without this, the bundle would be smaller but the createXXX methods from mesh would not be accessible.
import {MeshBuilder} from  "@babylonjs/core/Meshes/meshBuilder";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine


/******* Add the Playground Class with a static CreateScene function ******/
class Playground { 
    public static CreateScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
        // Create the scene space
        var scene = new Scene(engine);

        var camera = new ArcRotateCamera("Camera", 3 * Math.PI / 2, Math.PI / 4, 100, Vector3.Zero(), scene);
	    camera.attachControl(canvas, true, false);

        var light = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        
        // Skybox
        var skybox = Mesh.CreateBox("skyBox", 1000, scene);
        var skyboxMaterial = new StandardMaterial("skyBox", scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.reflectionTexture = new CubeTexture("src/textures/skybox3", scene);
        skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
        skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
        skyboxMaterial.specularColor = new Color3(0, 0, 0);
        skyboxMaterial.disableLighting = true;
        skybox.material = skyboxMaterial;
                
        // Ground
        var groundTexture = new Texture("src/textures/grass.dds", scene);
        groundTexture.vScale = groundTexture.uScale = 8.0;
        
        var groundMaterial = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseTexture = groundTexture;
        
        var ground = Mesh.CreateGround("ground", 512, 512, 32, scene, false);
        ground.position.y = -1;
        ground.material = groundMaterial;
            
        // Water
        var waterMesh = Mesh.CreateGround("waterMesh", 512, 512, 32, scene, false);
        var water = new WaterMaterial("water", scene, new Vector2(512, 512));
        water.backFaceCulling = true;
        water.bumpTexture = new Texture("src/textures/waterbump.png", scene);
        water.windForce = -5;
        water.waveHeight = 0.2;
        water.bumpHeight = 0.05;
        water.waterColor = new Color3(0.047, 0.23, 0.015);
        water.colorBlendFactor = 0.5;
        water.addToRenderList(skybox);
        water.addToRenderList(ground);
        waterMesh.material = water;

        return scene;
    }
}

/******* End of the create scene function ******/    
// code to use the Class above
const createScene = function(): Scene { 
    return Playground.CreateScene(engine, 
        engine.getRenderingCanvas() as HTMLCanvasElement); 
}

const scene = createScene(); //Call the createScene function

// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function () { 
    scene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function () { 
    engine.resize();
});
