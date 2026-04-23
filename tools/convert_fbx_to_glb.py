import argparse
import json
import sys
from pathlib import Path

import bpy


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def import_fbx(path: Path):
    bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)


def normalize_scene():
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next((obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"), None)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.name = obj.name.replace(" ", "_")
            obj.data.name = obj.data.name.replace(" ", "_")
            for material in obj.data.materials:
                if material:
                    material.use_nodes = True


def export_glb(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_skins=True,
        export_morph=False,
        export_materials="EXPORT",
    )


def scene_report():
    return {
        "objects": [
            {
                "name": obj.name,
                "type": obj.type,
                "children": len(obj.children),
            }
            for obj in bpy.context.scene.objects
        ],
        "meshes": [
            {
                "name": obj.name,
                "vertices": len(obj.data.vertices),
                "polygons": len(obj.data.polygons),
                "materials": [mat.name for mat in obj.data.materials if mat],
            }
            for obj in bpy.context.scene.objects
            if obj.type == "MESH"
        ],
        "armatures": [
            {
                "name": obj.name,
                "bones": len(obj.data.bones),
            }
            for obj in bpy.context.scene.objects
            if obj.type == "ARMATURE"
        ],
        "actions": [
            {
                "name": action.name,
                "frame_range": [action.frame_range[0], action.frame_range[1]],
                "channels": len(getattr(action, "fcurves", [])),
            }
            for action in bpy.data.actions
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    args = parser.parse_args(argv)

    clear_scene()
    import_fbx(Path(args.input))
    normalize_scene()
    export_glb(Path(args.output))

    report = scene_report()
    print(json.dumps(report, indent=2))
    if args.report:
        Path(args.report).write_text(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
