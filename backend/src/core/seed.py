import shutil
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.sheet import Connection, Folder, Node, Sheet


async def seed_database(session: AsyncSession):
    # Check if "Examples" folder already exists
    result = await session.execute(select(Folder).where(Folder.name == "Examples"))
    if result.scalar_one_or_none() is not None:
        print("'Examples' folder already exists. Skipping seed.")
        return

    print("Seeding database with sophisticated engineering examples...")

    # Create Examples Folder
    folder_id = uuid.uuid4()
    folder = Folder(id=folder_id, name="Examples")
    session.add(folder)
    await session.flush()

    # ==========================================
    # Sheet 1: Tsiolkovsky Rocket Equation (Base)
    # ==========================================
    sheet1_id = uuid.uuid4()
    sheet1 = Sheet(id=sheet1_id, name="Tsiolkovsky Rocket Equation", owner_name="System", folder_id=folder_id)

    # Nodes
    node_isp = Node(
        id=uuid.uuid4(),
        sheet_id=sheet1_id,
        type="input",
        label="Isp [s]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=100,
        data={"description": "Specific Impulse of the engine in seconds.", "min": "0"},
    )
    node_m0 = Node(
        id=uuid.uuid4(),
        sheet_id=sheet1_id,
        type="input",
        label="Initial Mass (m0) [kg]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=250,
        data={"description": "Initial total mass of the rocket (wet mass) in kg.", "min": "0"},
    )
    node_mf = Node(
        id=uuid.uuid4(),
        sheet_id=sheet1_id,
        type="input",
        label="Final Mass (mf) [kg]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=400,
        data={"description": "Final mass of the rocket (dry mass) in kg.", "min": "0"},
    )

    # Prepare attachment for Rocket Equation node
    resource_dir = Path(__file__).resolve().parent.parent.parent / "resources"
    upload_dir = Path(__file__).resolve().parent.parent.parent / "uploads"
    upload_dir.mkdir(exist_ok=True)

    image_name = "Tsiolkovsky's_Theoretical_Rocket_Diagram.png"
    source_image = resource_dir / image_name

    rocket_func_data = {
        "code": "g0 = 9.80665\nDeltaV = Isp * g0 * math.log(m0 / mf)",
        "description": "Calculates the Delta-V using the Tsiolkovsky rocket equation: \n"
        "$$\n\\Delta V = I_{sp} g_0 \\ln(\\frac{m_0}{m_f})\n$$",
    }

    if source_image.exists():
        # Create a unique filename for the attachment
        target_name = f"{uuid.uuid4()}_{image_name}"
        shutil.copy(source_image, upload_dir / target_name)

        rocket_func_data["attachment"] = target_name
        rocket_func_data["description"] += f"\n\n![Attachment](/attachments/{target_name})"
    else:
        print(f"Warning: Could not find seed image at {source_image}")

    node_rocket_func = Node(
        id=uuid.uuid4(),
        sheet_id=sheet1_id,
        type="function",
        label="Calculate Delta-V",
        inputs=[
            {"key": "Isp", "socket_type": "any"},
            {"key": "m0", "socket_type": "any"},
            {"key": "mf", "socket_type": "any"},
        ],
        outputs=[{"key": "DeltaV", "socket_type": "any"}],
        position_x=500,
        position_y=250,
        data=rocket_func_data,
    )

    node_dv = Node(
        id=uuid.uuid4(),
        sheet_id=sheet1_id,
        type="output",
        label="Delta-V [m/s]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=900,
        position_y=250,
        data={"description": "The total change in velocity achievable by the rocket.", "min": "0"},
    )

    # Connections
    conn1_1 = Connection(
        sheet_id=sheet1_id, source_id=node_isp.id, source_port="value", target_id=node_rocket_func.id, target_port="Isp"
    )
    conn1_2 = Connection(
        sheet_id=sheet1_id, source_id=node_m0.id, source_port="value", target_id=node_rocket_func.id, target_port="m0"
    )
    conn1_3 = Connection(
        sheet_id=sheet1_id, source_id=node_mf.id, source_port="value", target_id=node_rocket_func.id, target_port="mf"
    )
    conn1_4 = Connection(
        sheet_id=sheet1_id,
        source_id=node_rocket_func.id,
        source_port="DeltaV",
        target_id=node_dv.id,
        target_port="value",
    )

    session.add(sheet1)
    session.add_all([node_isp, node_m0, node_mf, node_rocket_func, node_dv])
    await session.flush()
    session.add_all([conn1_1, conn1_2, conn1_3, conn1_4])
    await session.flush()

    # ==========================================
    # Sheet 2: Dynamic Pressure (Base)
    # ==========================================
    sheet2_id = uuid.uuid4()
    sheet2 = Sheet(id=sheet2_id, name="Dynamic Pressure (q)", owner_name="System", folder_id=folder_id)

    node_rho = Node(
        id=uuid.uuid4(),
        sheet_id=sheet2_id,
        type="input",
        label="Density (rho) [kg/m3]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=100,
        data={"description": "Air density in kg/m³.", "min": "0"},
    )
    node_vel = Node(
        id=uuid.uuid4(),
        sheet_id=sheet2_id,
        type="input",
        label="Velocity (v) [m/s]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=250,
        data={"description": "Velocity of the object relative to the fluid in m/s.", "min": "0"},
    )

    node_q_func = Node(
        id=uuid.uuid4(),
        sheet_id=sheet2_id,
        type="function",
        label="Calculate q",
        inputs=[{"key": "rho", "socket_type": "any"}, {"key": "v", "socket_type": "any"}],
        outputs=[{"key": "q", "socket_type": "any"}],
        position_x=500,
        position_y=175,
        data={
            "code": "q = 0.5 * rho * v**2",
            "description": "Calculates dynamic pressure: $q = \\frac{1}{2} \\rho v^2$",
        },
    )

    node_q = Node(
        id=uuid.uuid4(),
        sheet_id=sheet2_id,
        type="output",
        label="Dynamic Pressure (q) [Pa]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=900,
        position_y=175,
        data={"description": "Dynamic pressure in Pascals.", "min": "0"},
    )

    conn2_1 = Connection(
        sheet_id=sheet2_id, source_id=node_rho.id, source_port="value", target_id=node_q_func.id, target_port="rho"
    )
    conn2_2 = Connection(
        sheet_id=sheet2_id, source_id=node_vel.id, source_port="value", target_id=node_q_func.id, target_port="v"
    )
    conn2_3 = Connection(
        sheet_id=sheet2_id, source_id=node_q_func.id, source_port="q", target_id=node_q.id, target_port="value"
    )

    session.add(sheet2)
    session.add_all([node_rho, node_vel, node_q_func, node_q])
    await session.flush()
    session.add_all([conn2_1, conn2_2, conn2_3])
    await session.flush()

    # ==========================================
    # Sheet 3: Aerodynamic Drag (Nested)
    # ==========================================
    sheet3_id = uuid.uuid4()
    sheet3 = Sheet(id=sheet3_id, name="Aerodynamic Drag Force", owner_name="System", folder_id=folder_id)

    # Inputs
    node_cd = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="input",
        label="Drag Coeff (Cd)",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=50,
        data={"description": "Drag coefficient (dimensionless).", "min": "0"},
    )
    node_area = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="input",
        label="Ref Area (A) [m2]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=200,
        data={"description": "Reference area (usually frontal area) in m².", "min": "0"},
    )
    node_d_rho = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="input",
        label="Density [kg/m3]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=350,
        data={"description": "Air density in kg/m³.", "min": "0"},
    )
    node_d_vel = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="input",
        label="Velocity [m/s]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=500,
        data={"description": "Velocity in m/s.", "min": "0"},
    )

    # Nested Sheet: Dynamic Pressure
    node_nested_q = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="sheet",
        label="Dynamic Pressure (q)",
        inputs=[
            {"key": "Density (rho) [kg/m3]", "socket_type": "any"},
            {"key": "Velocity (v) [m/s]", "socket_type": "any"},
        ],
        outputs=[{"key": "Dynamic Pressure (q) [Pa]", "socket_type": "any"}],
        position_x=500,
        position_y=400,
        data={"sheetId": str(sheet2_id)},
    )

    # Function: Drag
    node_drag_func = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="function",
        label="Calculate Drag",
        inputs=[
            {"key": "Cd", "socket_type": "any"},
            {"key": "A", "socket_type": "any"},
            {"key": "q", "socket_type": "any"},
        ],
        outputs=[{"key": "Drag", "socket_type": "any"}],
        position_x=900,
        position_y=250,
        data={"code": "Drag = Cd * A * q", "description": "Calculates drag force: $F_d = C_d \\cdot A \\cdot q$"},
    )

    # Output
    node_drag = Node(
        id=uuid.uuid4(),
        sheet_id=sheet3_id,
        type="output",
        label="Drag Force [N]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1200,
        position_y=250,
        data={"description": "Aerodynamic drag force in Newtons.", "min": "0"},
    )

    # Connections
    # Inputs to Nested Q
    conn3_1 = Connection(
        sheet_id=sheet3_id,
        source_id=node_d_rho.id,
        source_port="value",
        target_id=node_nested_q.id,
        target_port="Density (rho) [kg/m3]",
    )
    conn3_2 = Connection(
        sheet_id=sheet3_id,
        source_id=node_d_vel.id,
        source_port="value",
        target_id=node_nested_q.id,
        target_port="Velocity (v) [m/s]",
    )

    # Inputs to Drag Func
    conn3_3 = Connection(
        sheet_id=sheet3_id, source_id=node_cd.id, source_port="value", target_id=node_drag_func.id, target_port="Cd"
    )
    conn3_4 = Connection(
        sheet_id=sheet3_id, source_id=node_area.id, source_port="value", target_id=node_drag_func.id, target_port="A"
    )
    conn3_5 = Connection(
        sheet_id=sheet3_id,
        source_id=node_nested_q.id,
        source_port="Dynamic Pressure (q) [Pa]",
        target_id=node_drag_func.id,
        target_port="q",
    )

    # Func to Output
    conn3_6 = Connection(
        sheet_id=sheet3_id, source_id=node_drag_func.id, source_port="Drag", target_id=node_drag.id, target_port="value"
    )

    session.add(sheet3)
    session.add_all([node_cd, node_area, node_d_rho, node_d_vel, node_nested_q, node_drag_func, node_drag])
    await session.flush()
    session.add_all([conn3_1, conn3_2, conn3_3, conn3_4, conn3_5, conn3_6])
    await session.flush()

    # ==========================================
    # Sheet 4: SSTO Feasibility (Complex)
    # ==========================================
    sheet4_id = uuid.uuid4()
    sheet4 = Sheet(id=sheet4_id, name="SSTO Feasibility Check", owner_name="System", folder_id=folder_id)

    # Parameters
    node_pay = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="constant",
        label="Payload Mass [kg]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=100,
        data={"value": "2000", "description": "Mass of the payload to be delivered to orbit.", "min": "0"},
    )
    node_prop = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="constant",
        label="Propellant Mass [kg]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=250,
        data={"value": "93000", "description": "Mass of the propellant.", "min": "0"},
    )
    node_struc = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="constant",
        label="Structure Mass [kg]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=400,
        data={"value": "5000", "description": "Mass of the rocket structure (tanks, engines, etc.).", "min": "0"},
    )
    node_ssto_isp = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="constant",
        label="Engine Isp [s]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=550,
        data={"value": "380", "description": "Specific Impulse of the SSTO engine.", "min": "0"},
    )
    node_target_dv = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="constant",
        label="Target Delta-V [m/s]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=700,
        data={"value": "9000", "description": "Required Delta-V to reach the target orbit.", "min": "0"},
    )

    # Function: Mass Sums
    node_mass_func = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="function",
        label="Calculate Masses",
        inputs=[
            {"key": "mp", "socket_type": "any"},
            {"key": "mprop", "socket_type": "any"},
            {"key": "ms", "socket_type": "any"},
        ],
        outputs=[{"key": "m0", "socket_type": "any"}, {"key": "mf", "socket_type": "any"}],
        position_x=400,
        position_y=250,
        data={
            "code": "m0 = mp + mprop + ms\nmf = mp + ms",
            "description": "Calculates initial (wet) and final (dry) masses.",
        },
    )

    # Nested: Rocket Equation
    node_nested_rocket = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="sheet",
        label="Tsiolkovsky Rocket Equation",
        inputs=[
            {"key": "Isp [s]", "socket_type": "any"},
            {"key": "Initial Mass (m0) [kg]", "socket_type": "any"},
            {"key": "Final Mass (mf) [kg]", "socket_type": "any"},
        ],
        outputs=[{"key": "Delta-V [m/s]", "socket_type": "any"}],
        position_x=800,
        position_y=400,
        data={"sheetId": str(sheet1_id)},
    )

    # Function: Margin Check
    node_margin_func = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="function",
        label="Check Feasibility",
        inputs=[{"key": "Achieved_DV", "socket_type": "any"}, {"key": "Target_DV", "socket_type": "any"}],
        outputs=[{"key": "Margin", "socket_type": "any"}, {"key": "Is_Feasible", "socket_type": "any"}],
        position_x=1200,
        position_y=500,
        data={
            "code": 'Margin = Achieved_DV - Target_DV\nIs_Feasible = "YES" if Margin >= 0 else "NO"',
            "description": "Checks if the achieved Delta-V meets the target.",
        },
    )

    # Outputs
    node_out_dv = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="output",
        label="Achieved Delta-V",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1600,
        position_y=400,
        data={"description": "The calculated Delta-V capability of the vehicle.", "min": "0"},
    )
    node_out_margin = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="output",
        label="Margin [m/s]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1600,
        position_y=550,
        data={"description": "Excess Delta-V available (or deficit if negative).", "min": "0"},
    )
    node_out_feas = Node(
        id=uuid.uuid4(),
        sheet_id=sheet4_id,
        type="output",
        label="Feasible?",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1600,
        position_y=700,
        data={
            "description": "Boolean-like string indicating if the mission is feasible.",
            "dataType": "option",
            "options": ["YES", "NO"],
        },
    )

    # Connections
    # Inputs -> Mass Func
    conn4_1 = Connection(
        sheet_id=sheet4_id, source_id=node_pay.id, source_port="value", target_id=node_mass_func.id, target_port="mp"
    )
    conn4_2 = Connection(
        sheet_id=sheet4_id,
        source_id=node_prop.id,
        source_port="value",
        target_id=node_mass_func.id,
        target_port="mprop",
    )
    conn4_3 = Connection(
        sheet_id=sheet4_id, source_id=node_struc.id, source_port="value", target_id=node_mass_func.id, target_port="ms"
    )

    # Mass Func -> Nested Rocket
    conn4_4 = Connection(
        sheet_id=sheet4_id,
        source_id=node_mass_func.id,
        source_port="m0",
        target_id=node_nested_rocket.id,
        target_port="Initial Mass (m0) [kg]",
    )
    conn4_5 = Connection(
        sheet_id=sheet4_id,
        source_id=node_mass_func.id,
        source_port="mf",
        target_id=node_nested_rocket.id,
        target_port="Final Mass (mf) [kg]",
    )

    # Isp -> Nested Rocket
    conn4_6 = Connection(
        sheet_id=sheet4_id,
        source_id=node_ssto_isp.id,
        source_port="value",
        target_id=node_nested_rocket.id,
        target_port="Isp [s]",
    )

    # Nested Rocket -> Margin Func & Output
    conn4_7 = Connection(
        sheet_id=sheet4_id,
        source_id=node_nested_rocket.id,
        source_port="Delta-V [m/s]",
        target_id=node_margin_func.id,
        target_port="Achieved_DV",
    )
    conn4_8 = Connection(
        sheet_id=sheet4_id,
        source_id=node_nested_rocket.id,
        source_port="Delta-V [m/s]",
        target_id=node_out_dv.id,
        target_port="value",
    )

    # Target DV -> Margin Func
    conn4_9 = Connection(
        sheet_id=sheet4_id,
        source_id=node_target_dv.id,
        source_port="value",
        target_id=node_margin_func.id,
        target_port="Target_DV",
    )

    # Margin Func -> Outputs
    conn4_10 = Connection(
        sheet_id=sheet4_id,
        source_id=node_margin_func.id,
        source_port="Margin",
        target_id=node_out_margin.id,
        target_port="value",
    )
    conn4_11 = Connection(
        sheet_id=sheet4_id,
        source_id=node_margin_func.id,
        source_port="Is_Feasible",
        target_id=node_out_feas.id,
        target_port="value",
    )

    session.add(sheet4)
    session.add_all(
        [
            node_pay,
            node_prop,
            node_struc,
            node_ssto_isp,
            node_target_dv,
            node_mass_func,
            node_nested_rocket,
            node_margin_func,
            node_out_dv,
            node_out_margin,
            node_out_feas,
        ]
    )
    await session.flush()
    session.add_all(
        [conn4_1, conn4_2, conn4_3, conn4_4, conn4_5, conn4_6, conn4_7, conn4_8, conn4_9, conn4_10, conn4_11]
    )

    # ==========================================
    # Sheet 5: Material Selection (LUT Node)
    # ==========================================
    sheet5_id = uuid.uuid4()
    sheet5 = Sheet(id=sheet5_id, name="Material Selection Example", owner_name="System", folder_id=folder_id)

    # Nodes
    node_material = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="constant",
        label="Material",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=100,
        data={
            "dataType": "option",
            "options": ["Steel", "Aluminum", "Titanium"],
            "value": "Steel",
            "description": "Select the material for the component. This node gets its options from the connected LUT.",
        },
    )

    node_volume = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="constant",
        label="Volume [m^3]",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=250,
        data={"value": "1.0", "description": "Volume of the component.", "min": "0"},
    )

    node_strain = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="constant",
        label="Strain",
        inputs=[],
        outputs=[{"key": "value", "socket_type": "any"}],
        position_x=100,
        position_y=400,
        data={"value": "0.001", "description": "Applied strain (dimensionless).", "min": "0"},
    )

    node_material_lut = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="lut",
        label="Material Properties LUT",
        inputs=[{"key": "key", "socket_type": "any"}],
        outputs=[
            {"key": "Density [kg/m^3]", "socket_type": "any"},
            {"key": "Young's Modulus [GPa]", "socket_type": "any"},
        ],
        position_x=400,
        position_y=100,
        data={
            "description": "Look up density and Young's modulus based on material name.",
            "lut": {
                "rows": [
                    {"key": "Steel", "values": {"Density [kg/m^3]": 7850, "Young's Modulus [GPa]": 210}},
                    {"key": "Aluminum", "values": {"Density [kg/m^3]": 2700, "Young's Modulus [GPa]": 70}},
                    {"key": "Titanium", "values": {"Density [kg/m^3]": 4500, "Young's Modulus [GPa]": 110}},
                ]
            },
        },
    )

    node_mass_calc = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="function",
        label="Calculate Mass",
        inputs=[{"key": "density", "socket_type": "any"}, {"key": "volume", "socket_type": "any"}],
        outputs=[{"key": "mass", "socket_type": "any"}],
        position_x=750,
        position_y=150,
        data={"code": "mass = density * volume", "description": "Calculate mass from density and volume."},
    )

    node_stress_calc = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="function",
        label="Calculate Stress",
        inputs=[{"key": "E", "socket_type": "any"}, {"key": "epsilon", "socket_type": "any"}],
        outputs=[{"key": "stress", "socket_type": "any"}],
        position_x=750,
        position_y=350,
        data={"code": "stress = E * epsilon", "description": "Calculate stress using Hooke's Law: $\\sigma = E \\cdot \\epsilon$"},
    )

    node_out_mass = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="output",
        label="Mass [kg]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1050,
        position_y=150,
        data={"description": "Total mass of the component.", "min": "0"},
    )

    node_out_stress = Node(
        id=uuid.uuid4(),
        sheet_id=sheet5_id,
        type="output",
        label="Stress [GPa]",
        inputs=[{"key": "value", "socket_type": "any"}],
        outputs=[],
        position_x=1050,
        position_y=350,
        data={"description": "Calculated stress based on applied strain.", "min": "0"},
    )

    # Connections
    conn5_1 = Connection(
        sheet_id=sheet5_id,
        source_id=node_material.id,
        source_port="value",
        target_id=node_material_lut.id,
        target_port="key",
    )
    conn5_2 = Connection(
        sheet_id=sheet5_id,
        source_id=node_material_lut.id,
        source_port="Density [kg/m^3]",
        target_id=node_mass_calc.id,
        target_port="density",
    )
    conn5_3 = Connection(
        sheet_id=sheet5_id,
        source_id=node_volume.id,
        source_port="value",
        target_id=node_mass_calc.id,
        target_port="volume",
    )
    conn5_4 = Connection(
        sheet_id=sheet5_id,
        source_id=node_mass_calc.id,
        source_port="mass",
        target_id=node_out_mass.id,
        target_port="value",
    )
    conn5_5 = Connection(
        sheet_id=sheet5_id,
        source_id=node_material_lut.id,
        source_port="Young's Modulus [GPa]",
        target_id=node_stress_calc.id,
        target_port="E",
    )
    conn5_6 = Connection(
        sheet_id=sheet5_id,
        source_id=node_strain.id,
        source_port="value",
        target_id=node_stress_calc.id,
        target_port="epsilon",
    )
    conn5_7 = Connection(
        sheet_id=sheet5_id,
        source_id=node_stress_calc.id,
        source_port="stress",
        target_id=node_out_stress.id,
        target_port="value",
    )

    session.add(sheet5)
    session.add_all([node_material, node_volume, node_strain, node_material_lut, node_mass_calc, node_stress_calc, node_out_mass, node_out_stress])
    await session.flush()
    session.add_all([conn5_1, conn5_2, conn5_3, conn5_4, conn5_5, conn5_6, conn5_7])

    await session.commit()
    print("Database seeded successfully.")
