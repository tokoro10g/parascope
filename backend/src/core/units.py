import pint

ureg = pint.UnitRegistry()
ureg.define('dollar = [currency]')
Q_ = ureg.Quantity
