import pytest

from app.infrastructure.storage.local import LocalEvidenceStorage


def test_save_read_and_delete(tmp_path):
    storage = LocalEvidenceStorage(tmp_path / "evidence")
    name = storage.save(b"datos", "png")

    assert name.endswith(".png")
    assert storage.path(name).read_bytes() == b"datos"

    storage.delete(name)
    assert not storage.path(name).exists()
    storage.delete(name)  # borrar dos veces no falla


def test_names_are_unique(tmp_path):
    storage = LocalEvidenceStorage(tmp_path)
    assert storage.save(b"a", "jpg") != storage.save(b"a", "jpg")


@pytest.mark.parametrize("extension", ["exe", "html", "svg", "PNG", "", "png/../x"])
def test_only_known_extensions_are_saved(tmp_path, extension):
    with pytest.raises(ValueError):
        LocalEvidenceStorage(tmp_path).save(b"x", extension)


@pytest.mark.parametrize(
    "name",
    [
        "../secreto.png",
        "..\\secreto.png",
        "/etc/passwd",
        "C:\\Windows\\win.ini",
        "nombre-inventado.png",
        "00000000-0000-0000-0000-000000000000.exe",
        "00000000-0000-0000-0000-000000000000.png/../x",
        "",
    ],
)
def test_only_names_generated_by_the_storage_are_resolved(tmp_path, name):
    storage = LocalEvidenceStorage(tmp_path)
    with pytest.raises(ValueError):
        storage.path(name)
    storage.delete(name)  # y borrar un nombre inválido es inofensivo


def test_delete_never_touches_files_outside_the_folder(tmp_path):
    outside = tmp_path / "importante.png"
    outside.write_bytes(b"no me borres")
    storage = LocalEvidenceStorage(tmp_path / "evidence")

    storage.delete("../importante.png")

    assert outside.read_bytes() == b"no me borres"
