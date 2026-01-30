from src.core.utils import serialize_result


def test_serialize_result_basics():
    assert serialize_result(10) == "10"
    assert serialize_result(3.14) == "3.14"
    assert serialize_result(True) is True
    assert serialize_result(False) is False
    assert serialize_result(None) is None
    assert serialize_result("hello") == "hello"


def test_serialize_result_special_numbers():
    assert serialize_result(float("nan")) == "nan"
    assert serialize_result(float("inf")) == "inf"
    assert serialize_result(float("-inf")) == "-inf"


def test_serialize_result_structures():
    data = {"a": 1, "b": [2.5, float("inf")], "c": {"d": float("nan")}}
    expected = {"a": "1", "b": ["2.5", "inf"], "c": {"d": "nan"}}
    assert serialize_result(data) == expected
