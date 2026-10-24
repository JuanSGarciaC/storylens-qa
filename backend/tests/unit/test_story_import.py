import json

import pytest

from app.domain.story_import import (
    ImportFormatError,
    build_rows,
    parse_csv,
    parse_json,
    parse_table,
    split_criteria,
    suggest_mapping,
    validate_mapping,
)

JIRA_CSV = (
    "Summary,Issue key,Description,Labels,Labels,Custom field (Acceptance Criteria)\n"
    'Retirar efectivo,BANK-1,"Como cliente quiero retirar efectivo","a","b",'
    '"* Dado saldo 500, cuando retiro 100, entonces queda 400\n* Retiro mayor al saldo: error"\n'
    "Sin descripción,BANK-2,,,,\n"
)


def test_csv_headers_repeated_by_jira_are_made_unique():
    table = parse_csv(JIRA_CSV)
    assert table.headers == [
        "Summary",
        "Issue key",
        "Description",
        "Labels",
        "Labels (2)",
        "Custom field (Acceptance Criteria)",
    ]
    assert table.rows[0]["Issue key"] == "BANK-1"


def test_mapping_is_suggested_from_jira_column_names():
    mapping = suggest_mapping(parse_csv(JIRA_CSV).headers)
    assert mapping == {
        "title": "Summary",
        "description": "Description",
        "acceptance_criteria": "Custom field (Acceptance Criteria)",
        "key": "Issue key",
    }


def test_spanish_headers_and_accents_are_recognized():
    mapping = suggest_mapping(["Resumen", "Descripción", "Criterios de aceptación", "Clave"])
    assert mapping == {
        "title": "Resumen",
        "description": "Descripción",
        "acceptance_criteria": "Criterios de aceptación",
        "key": "Clave",
    }


def test_semicolon_csv_is_supported():
    table = parse_csv("Summary;Description\nHola;Quiero algo\n")
    assert table.rows == [{"Summary": "Hola", "Description": "Quiero algo"}]


def test_rows_split_criteria_bullets_and_flag_missing_description():
    table = parse_csv(JIRA_CSV)
    rows = build_rows(table, suggest_mapping(table.headers), max_chars=10_000)
    assert rows[0].acceptance_criteria == (
        "Dado saldo 500, cuando retiro 100, entonces queda 400",
        "Retiro mayor al saldo: error",
    )
    assert rows[0].importable and rows[0].key == "BANK-1"
    assert rows[1].issues == ["Sin descripción"] and not rows[1].importable


def test_criteria_embedded_in_the_description_are_separated():
    table = parse_csv(
        "Summary,Description\n"
        'Historia,"Como usuario quiero X\n\nh3. Acceptance Criteria\n# Uno\n# Dos"\n'
    )
    row = build_rows(table, suggest_mapping(table.headers), 10_000)[0]
    assert row.description == "Como usuario quiero X"
    assert row.acceptance_criteria == ("Uno", "Dos")


def test_oversized_story_is_flagged():
    table = parse_csv("Summary,Description\nT," + "x" * 200 + "\n")
    row = build_rows(table, suggest_mapping(table.headers), max_chars=100)[0]
    assert any("máximo" in issue for issue in row.issues)


def test_jira_rest_json_with_adf_description_is_flattened():
    document = {
        "issues": [
            {
                "key": "BANK-9",
                "fields": {
                    "summary": "Login",
                    "priority": {"name": "High"},
                    "description": {
                        "type": "doc",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "Quiero entrar"}],
                            },
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "Sin fricción"}],
                            },
                        ],
                    },
                },
            }
        ]
    }
    table = parse_json(json.dumps(document))
    assert table.rows[0]["description"] == "Quiero entrar\nSin fricción"
    assert table.rows[0]["priority"] == "High" and table.rows[0]["key"] == "BANK-9"
    assert suggest_mapping(table.headers)["title"] == "summary"


def test_plain_json_list_is_supported_and_format_is_detected():
    kind, table = parse_table("export.txt", b'[{"title": "A", "description": "B"}]')
    assert kind == "json" and table.rows == [{"title": "A", "description": "B"}]


def test_utf8_bom_and_latin1_files_are_decoded():
    assert (
        parse_table("a.csv", "﻿Summary,Description\nÑu,x\n".encode())[1].rows[0]["Summary"] == "Ñu"
    )
    assert (
        parse_table("a.csv", "Summary,Description\nPingüino,x\n".encode("latin-1"))[1].rows[0][
            "Summary"
        ]
        == "Pingüino"
    )


@pytest.mark.parametrize(
    "name, data",
    [
        ("a.csv", b""),
        ("a.csv", b"Solo,encabezados\n"),
        ("a.json", b"{no es json"),
        ("a.json", b'{"issues": []}'),
        ("a.json", b'{"otra": 1}'),
        ("a.json", b"[1, 2]"),
    ],
)
def test_invalid_files_raise_a_clear_error(name, data):
    with pytest.raises(ImportFormatError):
        parse_table(name, data)


def test_rows_are_capped_and_truncation_is_reported():
    lines = "\n".join(f"T{i},D{i}" for i in range(600))
    table = parse_csv("Summary,Description\n" + lines)
    assert len(table.rows) == 500 and table.truncated


def test_mapping_must_point_to_existing_columns():
    with pytest.raises(ImportFormatError):
        validate_mapping({"description": "Nope"}, ["Summary"])


def test_split_criteria_strips_bullets_and_blank_lines():
    assert split_criteria("- uno\n\n2) dos\n* tres\n#  cuatro") == ("uno", "dos", "tres", "cuatro")
