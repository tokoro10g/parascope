--
-- PostgreSQL database dump
--

\restrict JoKcvap2rCFD39PaET3yd9img43c7doZdhgbLmGzGj8PL7t8WwYacZhGx78sLUd

-- Dumped from database version 15.15 (Debian 15.15-1.pgdg13+1)
-- Dumped by pg_dump version 15.15 (Debian 15.15-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    user_name character varying NOT NULL,
    "timestamp" timestamp without time zone NOT NULL,
    delta jsonb NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO "user";

--
-- Name: connections; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.connections (
    id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    source_id uuid NOT NULL,
    source_port character varying NOT NULL,
    target_id uuid NOT NULL,
    target_port character varying NOT NULL
);


ALTER TABLE public.connections OWNER TO "user";

--
-- Name: folders; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.folders (
    id uuid NOT NULL,
    name character varying NOT NULL,
    parent_id uuid,
    owner_name character varying
);


ALTER TABLE public.folders OWNER TO "user";

--
-- Name: nodes; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.nodes (
    id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    type character varying NOT NULL,
    label character varying NOT NULL,
    inputs jsonb NOT NULL,
    outputs jsonb NOT NULL,
    position_x double precision NOT NULL,
    position_y double precision NOT NULL,
    data jsonb NOT NULL
);


ALTER TABLE public.nodes OWNER TO "user";

--
-- Name: sheet_locks; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.sheet_locks (
    sheet_id uuid NOT NULL,
    user_id character varying NOT NULL,
    tab_id character varying,
    acquired_at timestamp without time zone NOT NULL,
    last_heartbeat_at timestamp without time zone NOT NULL,
    last_save_at timestamp without time zone
);


ALTER TABLE public.sheet_locks OWNER TO "user";

--
-- Name: sheet_versions; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.sheet_versions (
    id uuid NOT NULL,
    sheet_id uuid NOT NULL,
    version_tag character varying NOT NULL,
    description character varying,
    data jsonb NOT NULL,
    created_at timestamp without time zone NOT NULL,
    created_by character varying NOT NULL
);


ALTER TABLE public.sheet_versions OWNER TO "user";

--
-- Name: sheets; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.sheets (
    id uuid NOT NULL,
    name character varying NOT NULL,
    owner_name character varying,
    folder_id uuid,
    default_version_id uuid
);


ALTER TABLE public.sheets OWNER TO "user";

--
-- Name: user_read_states; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.user_read_states (
    user_name character varying NOT NULL,
    sheet_id uuid NOT NULL,
    last_read_at timestamp without time zone NOT NULL
);


ALTER TABLE public.user_read_states OWNER TO "user";

--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.audit_logs (id, sheet_id, user_name, "timestamp", delta) FROM stdin;
392eaf97-35fa-4ee4-ba97-a9b3dbac693e	1ea41c25-0883-4d12-8f72-13a6a2d1258d	Test User	2026-01-23 04:42:12.264218	[{"new": "", "old": "45", "field": "value", "label": "Launch Angle [deg]", "node_id": "3e7a6cd1-85d3-456d-9fb2-ef49095f9e95"}, {"new": "", "old": "100", "field": "value", "label": "Initial Velocity (v0) [m/s]", "node_id": "4cba2fbf-b58e-4657-b8ae-fc4b106ffc07"}]
ba21a7ca-95ca-47e8-995f-043d0f1f024e	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-01-24 09:49:34.437616	[{"new": "40320.19591086859", "old": null, "field": "value", "label": "Achieved Delta-V", "node_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3"}, {"new": "31320.19591086859", "old": null, "field": "value", "label": "Margin [m/s]", "node_id": "4586e852-e619-430b-9916-10d895692e60"}, {"new": "YES", "old": null, "field": "value", "label": "Feasible?", "node_id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf"}]
6628860f-ab67-4788-a29f-eb32b753508c	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-01-24 09:50:37.738337	[{"new": "9909.804327650992", "old": "40320.19591086859", "field": "value", "label": "Achieved Delta-V", "node_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3"}, {"new": "909.8043276509925", "old": "31320.19591086859", "field": "value", "label": "Margin [m/s]", "node_id": "4586e852-e619-430b-9916-10d895692e60"}, {"new": "deleted", "old": "existing", "field": "node", "label": "Target Delta-V [m/s]", "node_id": "0f7a5ac1-14b5-48fc-b46e-6a007acb2e90"}]
e982deab-ac25-466d-8f69-eebb5643e241	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-01-24 11:19:08.032778	[{"new": "deleted", "old": "existing", "field": "node", "label": "Margin [m/s]", "node_id": "4586e852-e619-430b-9916-10d895692e60"}]
3faed349-7c8e-4d7d-a97d-da55ce2d51df	7b2d23f4-923a-4278-8f34-863d9c715fa5	Test User	2026-01-24 12:34:00.621006	[{"new": "7850", "old": null, "field": "value", "label": "Mass [kg]", "node_id": "e12875bc-9fba-4a57-8bde-08e33a64421d"}, {"new": "0.21", "old": null, "field": "value", "label": "Stress [GPa]", "node_id": "20d51cc6-06ab-4bfd-afa5-d7c37fe1010a"}]
aa8f0c90-67a6-4221-88cc-884b8197635c	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-01-29 07:40:45.054153	[{"new": null, "old": "9909.804327650992", "field": "value", "label": "Achieved Delta-V", "node_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3"}, {"new": null, "old": "YES", "field": "value", "label": "Feasible?", "node_id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf"}]
5684942e-946e-4e3b-b143-943c73517539	801a9982-62d3-4941-9d34-2a92b22f8e78	Test User	2026-01-30 06:43:49.309807	[{"new": "deleted", "old": "existing", "field": "node", "label": "Some new inputs", "node_id": "0df032bc-f22a-4616-8af2-64c1dbc913d6"}]
6be59ba5-b498-4d21-81e4-63b9252e9d63	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-01-30 09:28:09.963177	[{"new": "Target Delta-V [m/s]e", "old": "Target Delta-V [m/s]", "field": "label", "label": "Target Delta-V [m/s]e", "node_id": "1a24887f-64c3-4aef-8c90-5c76dc97433d"}]
a934611a-c96a-4151-8ea3-ca0560deaddd	40cb86c3-791e-4f5f-99c7-d1408acf7821	Test User	2026-02-03 14:58:01.571696	[{"new": "Aluminum", "old": "Steel", "field": "value", "label": "Material", "node_id": "cc80893a-795f-4472-881f-1627c5d2ea6b"}]
90b8d664-df22-483e-9b64-ddfd2def6288	40cb86c3-791e-4f5f-99c7-d1408acf7821	Test User	2026-02-03 14:59:02.977345	[{"new": "", "old": "Aluminum", "field": "value", "label": "Material", "node_id": "cc80893a-795f-4472-881f-1627c5d2ea6b"}]
99b9175e-1714-41c2-97ca-26112f0f0206	40cb86c3-791e-4f5f-99c7-d1408acf7821	Test User	2026-02-03 14:59:20.608301	[{"new": "Steel", "old": null, "field": "value", "label": "Material", "node_id": "cc80893a-795f-4472-881f-1627c5d2ea6b"}]
cca22e18-c689-499e-95e6-5077fce42457	40cb86c3-791e-4f5f-99c7-d1408acf7821	Test User	2026-02-03 15:02:41.824934	[{"new": "Titanium", "old": "Steel", "field": "value", "label": "Material", "node_id": "cc80893a-795f-4472-881f-1627c5d2ea6b"}]
abd54b6b-6a5d-4e84-bd1d-d196469d1193	40cb86c3-791e-4f5f-99c7-d1408acf7821	Test User	2026-02-03 15:02:52.224447	[{"new": "Steel", "old": null, "field": "value", "label": "Material", "node_id": "cc80893a-795f-4472-881f-1627c5d2ea6b"}]
52d35e51-eb0a-4d27-8d3c-70e51db6853e	801a9982-62d3-4941-9d34-2a92b22f8e78	Test User	2026-02-04 05:29:39.576889	[{"new": "deleted", "old": "existing", "field": "node", "label": "hoge", "node_id": "c7076f89-87f8-4ef6-9dbf-52a0f8a79af4"}]
3a442636-4450-4ec0-a93b-e95b7b8838d1	801a9982-62d3-4941-9d34-2a92b22f8e78	Test User	2026-02-04 05:50:59.327708	[{"new": "deleted", "old": "existing", "field": "node", "label": "Final Mass (mf) [kg] (1)", "node_id": "27410c0c-cff3-449d-95ed-9bf85b224aaa"}]
a3b2b25e-3e29-48cf-9b58-74fc9bd98c15	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-02-04 06:58:31.318418	[{"new": "deleted", "old": "existing", "field": "node", "label": "Target Delta-V [m/s]e", "node_id": "1a24887f-64c3-4aef-8c90-5c76dc97433d"}]
ce4d555a-a318-4cfd-9bd9-2f665ee46e8c	801a9982-62d3-4941-9d34-2a92b22f8e78	Test User	2026-02-06 03:35:32.813064	[{"new": "deleted", "old": "existing", "field": "node", "label": "Constant", "node_id": "5190a234-3682-4bd3-b1fb-a419a09cf65c"}]
8e77aa05-cad4-4781-8847-739f9f0aae02	c00515de-775c-4250-93de-9ae4075d93a8	Test User	2026-02-06 03:38:04.36695	[{"new": "deleted", "old": "existing", "field": "node", "label": "Output", "node_id": "da8357ab-5184-4767-b98c-ecd469f75a3a"}]
\.


--
-- Data for Name: connections; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.connections (id, sheet_id, source_id, source_port, target_id, target_port) FROM stdin;
94f0e571-1288-4923-8097-238174f64061	801a9982-62d3-4941-9d34-2a92b22f8e78	a155218d-32b1-4593-aed4-c6a89f730185	value	4f44f79c-629e-4ee9-a0ad-47baa5e24d03	Isp
cc48a6b3-a37b-4a44-b386-761e5d39d46f	801a9982-62d3-4941-9d34-2a92b22f8e78	7603d9a5-442c-4d35-a64a-41b987a2e5ee	value	4f44f79c-629e-4ee9-a0ad-47baa5e24d03	m0
abbba1ad-432c-4443-bbce-e303108481d0	801a9982-62d3-4941-9d34-2a92b22f8e78	f33d19cc-8f19-4a4e-9db4-e11f067033fa	value	4f44f79c-629e-4ee9-a0ad-47baa5e24d03	mf
8d1826ec-b5a7-4e92-8a35-6e12baa25128	801a9982-62d3-4941-9d34-2a92b22f8e78	4f44f79c-629e-4ee9-a0ad-47baa5e24d03	DeltaV	f4f395d0-94a4-431d-8da9-dd0bff081a79	value
d8630c56-2c40-49ec-9909-9e37ee8c578e	7b2d23f4-923a-4278-8f34-863d9c715fa5	92da5ed9-4a0d-414d-9605-5ccf98770d85	value	65c103a6-e2df-4449-9af6-519a2cc79ad2	key
c50d7bf7-6c81-469f-ad28-69883864aa77	7b2d23f4-923a-4278-8f34-863d9c715fa5	65c103a6-e2df-4449-9af6-519a2cc79ad2	Density [kg/m^3]	94bf1e8a-b089-4018-aa02-983bec869bf4	density
262dcf92-6b2c-41d4-9885-9d9bd3121dee	7b2d23f4-923a-4278-8f34-863d9c715fa5	d56fb6b5-40b5-4387-8a98-1ce8333267bc	value	94bf1e8a-b089-4018-aa02-983bec869bf4	volume
0a71ea4c-7edf-489f-8c7a-db25bcfa0f95	7b2d23f4-923a-4278-8f34-863d9c715fa5	94bf1e8a-b089-4018-aa02-983bec869bf4	mass	e12875bc-9fba-4a57-8bde-08e33a64421d	value
39da424b-04f8-427c-ae0d-81ac6ce551af	7b2d23f4-923a-4278-8f34-863d9c715fa5	65c103a6-e2df-4449-9af6-519a2cc79ad2	Young's Modulus [GPa]	2dc4a3cb-f045-4315-a55c-c765a170eb84	E
280073e0-c547-4872-9b7e-f81eb8eb013a	7b2d23f4-923a-4278-8f34-863d9c715fa5	78d75c86-1fc3-4ed8-8936-af1bb32cc38d	value	2dc4a3cb-f045-4315-a55c-c765a170eb84	epsilon
5e2015fc-cbce-464b-89c7-f2911728e23d	7b2d23f4-923a-4278-8f34-863d9c715fa5	2dc4a3cb-f045-4315-a55c-c765a170eb84	stress	20d51cc6-06ab-4bfd-afa5-d7c37fe1010a	value
66742ae4-45f1-480d-bcce-109f8b62c65f	1ea41c25-0883-4d12-8f72-13a6a2d1258d	3e7a6cd1-85d3-456d-9fb2-ef49095f9e95	value	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	angle_deg
9a16d7d9-8f8b-4529-b5f2-7333680383d9	1ea41c25-0883-4d12-8f72-13a6a2d1258d	4cba2fbf-b58e-4657-b8ae-fc4b106ffc07	value	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	v0
2a4c5201-422e-479f-88b8-4732241a7be8	1ea41c25-0883-4d12-8f72-13a6a2d1258d	fc3c8931-9922-461f-b40c-1d171ba65f55	value	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	g
59402881-b532-4e06-8dde-6805a327a524	1ea41c25-0883-4d12-8f72-13a6a2d1258d	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	Range	d7b230bc-94cb-4882-b5ae-d7dd9ecdeda7	value
3cf092bc-6b61-449d-9003-01ffc7eb0be3	1ea41c25-0883-4d12-8f72-13a6a2d1258d	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	MaxHeight	fec44be0-bd98-440a-878e-4e1b92d69f88	value
b44d918a-92a5-4d13-bc9e-a2d5af189639	1ea41c25-0883-4d12-8f72-13a6a2d1258d	dcb2527b-a122-4072-bb70-c4dfe8e91dd7	FlightTime	e581bc45-b26a-4690-b500-44252b434202	value
64c0ec7f-59b3-4969-bbcc-858fd306cfa1	40cb86c3-791e-4f5f-99c7-d1408acf7821	cc80893a-795f-4472-881f-1627c5d2ea6b	value	4e056a2f-7c98-4226-9fbc-6847ac7b3748	key
128a68d3-276e-4098-ac9e-d83fe378e391	40cb86c3-791e-4f5f-99c7-d1408acf7821	4e056a2f-7c98-4226-9fbc-6847ac7b3748	Density [kg/m^3]	b9c7700d-3233-4f1e-b349-ee90fa82e3e7	density
262d916a-8d58-4047-8e7e-0a990cf857ea	40cb86c3-791e-4f5f-99c7-d1408acf7821	2fc1616e-0025-4622-b3f6-f776df630bbe	value	b9c7700d-3233-4f1e-b349-ee90fa82e3e7	volume
a39adcef-fd70-4d03-b40f-c06443a5255a	40cb86c3-791e-4f5f-99c7-d1408acf7821	b9c7700d-3233-4f1e-b349-ee90fa82e3e7	mass	27d6c8b5-ae5c-4045-87b7-bd646766529c	value
023902bd-ff90-4b7a-9174-12f5d0dda033	40cb86c3-791e-4f5f-99c7-d1408acf7821	4e056a2f-7c98-4226-9fbc-6847ac7b3748	Young's Modulus [GPa]	e61b17ac-bc56-450f-9aab-a0804fabf31d	E
e33c3537-fe5b-4351-9ac6-e5ee73085212	40cb86c3-791e-4f5f-99c7-d1408acf7821	4e4ee853-526c-4a7d-85b0-ec2a4d246960	value	e61b17ac-bc56-450f-9aab-a0804fabf31d	epsilon
86b3bd03-ae16-4d8d-aaa2-2653a15ececb	40cb86c3-791e-4f5f-99c7-d1408acf7821	e61b17ac-bc56-450f-9aab-a0804fabf31d	stress	86e98a98-a08f-441f-8aa3-e9d109dfc07b	value
f17a2dce-ac60-4516-88bf-a2c6244983c2	07aad1cc-e750-4430-9f5a-d10883b412e3	5c2ca62a-2b0e-41cd-878b-aea79ac33461	value	d2869ebd-f3ca-4275-8152-7ccdbe90d037	mp
704fd745-a1f8-4ea3-ac1c-34f1ec1bf765	07aad1cc-e750-4430-9f5a-d10883b412e3	18dd42ac-0ec2-4684-8d67-dc3ffef427e2	value	d2869ebd-f3ca-4275-8152-7ccdbe90d037	mprop
01264fa0-92f5-42ec-a03e-b974c4cbc7fe	07aad1cc-e750-4430-9f5a-d10883b412e3	69c45d76-5a13-4423-8676-62ab97d79e9f	value	d2869ebd-f3ca-4275-8152-7ccdbe90d037	ms
6460493e-5550-486e-a92f-931dbc6c10cd	07aad1cc-e750-4430-9f5a-d10883b412e3	d2869ebd-f3ca-4275-8152-7ccdbe90d037	m0	d994a193-8a30-4aef-a1f7-c90f3fbe3abe	Initial Mass (m0) [kg]
84460c82-5098-4e8c-8c35-160ea477f40e	07aad1cc-e750-4430-9f5a-d10883b412e3	d2869ebd-f3ca-4275-8152-7ccdbe90d037	mf	d994a193-8a30-4aef-a1f7-c90f3fbe3abe	Final Mass (mf) [kg]
f24ad422-5033-412d-8d8e-912e6cf10295	07aad1cc-e750-4430-9f5a-d10883b412e3	011b0e5f-d9fa-429c-8388-1cd774198d04	value	d994a193-8a30-4aef-a1f7-c90f3fbe3abe	Isp [s]
942a1a34-badd-45b3-a9ac-e45df827a298	07aad1cc-e750-4430-9f5a-d10883b412e3	d994a193-8a30-4aef-a1f7-c90f3fbe3abe	Delta-V [m/s]	b27810ea-2318-4c05-b57f-3fbf4279f5b0	Achieved_DV
350d8a80-88b2-4ca9-ac5e-b195ee5ae172	07aad1cc-e750-4430-9f5a-d10883b412e3	d994a193-8a30-4aef-a1f7-c90f3fbe3abe	Delta-V [m/s]	3a3073ad-bb67-430e-9a81-bee436d7cd59	value
23e26a9b-2897-4556-8f5e-83655cf27b8a	07aad1cc-e750-4430-9f5a-d10883b412e3	bd8d64d0-a608-4af5-8522-984a807b3d3f	value	b27810ea-2318-4c05-b57f-3fbf4279f5b0	Target_DV
3473a5f4-dab7-4235-8541-c039976eedab	07aad1cc-e750-4430-9f5a-d10883b412e3	b27810ea-2318-4c05-b57f-3fbf4279f5b0	Margin	b20f8fd9-ebf5-4f83-a90f-4e20fcdb4d23	value
64545817-507c-4fbc-8e83-a0811fd59b4f	07aad1cc-e750-4430-9f5a-d10883b412e3	b27810ea-2318-4c05-b57f-3fbf4279f5b0	Is_Feasible	416a4570-1d1d-4e97-bdfa-b98e2920d34c	value
a6dd3fe9-e87e-4677-a8d3-14b369957e48	4f7d8b69-d867-4499-a8d9-b8d9c950949d	fead2524-1454-4c31-a99f-69e0ba2138d7	value	e3f217d7-d2c9-486e-935c-721c9830cc1b	rho
f6c9b230-c640-4f5c-8d3e-51efb4ec8bdd	4f7d8b69-d867-4499-a8d9-b8d9c950949d	46bc26d1-21d3-4427-97cf-6af122e783f6	value	e3f217d7-d2c9-486e-935c-721c9830cc1b	v
c7ed7e52-aa0a-4361-9420-452f950dccdf	4f7d8b69-d867-4499-a8d9-b8d9c950949d	e3f217d7-d2c9-486e-935c-721c9830cc1b	q	b3f60e06-6e81-4078-b22c-963fae221974	value
389985e4-dcf4-4368-8ef9-e1d90a597e41	c00515de-775c-4250-93de-9ae4075d93a8	7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	mf	be12d708-4c95-40da-95bd-8d15c3dd396e	Final Mass (mf) [kg]
735bcbff-2b82-4633-8dea-25c34716b43f	c00515de-775c-4250-93de-9ae4075d93a8	424eefd5-055e-43b4-b46f-80cc86a29b87	value	7687253f-15cf-441e-b1d1-34f47f9aaeb3	min
2e92a302-2c30-492a-beb1-55fc3d76adbc	c00515de-775c-4250-93de-9ae4075d93a8	02ae42c2-e586-4013-8478-750b78ddff85	value	7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	mp
93beeeaf-33ee-4f1a-8647-4eef9811f145	ace93fd1-0224-4888-af98-1670a9514b24	9cab3a80-f1f6-4009-999c-642561fc1054	value	73d69378-1295-49bc-8d92-24100bf004d1	Density (rho) [kg/m3]
ca2ad863-1382-483c-8c40-33e1c5af25e4	ace93fd1-0224-4888-af98-1670a9514b24	44f39a4e-46d5-4238-99e1-d5fd807bb575	value	73d69378-1295-49bc-8d92-24100bf004d1	Velocity (v) [m/s]
e8fe402e-c62d-46ad-976c-6612908ca35f	ace93fd1-0224-4888-af98-1670a9514b24	b4eb1398-a183-4270-b1f2-2e86e7ebee06	value	6e626a45-6872-4af8-9118-5ed4e2ba9a62	Cd
19301e68-9f98-441e-9b8c-a3142dcd0489	ace93fd1-0224-4888-af98-1670a9514b24	b62f2c63-7cae-4ece-b516-71a4d3030e34	value	6e626a45-6872-4af8-9118-5ed4e2ba9a62	A
2c23e54e-a655-45e4-824a-1b88c86e0b88	ace93fd1-0224-4888-af98-1670a9514b24	73d69378-1295-49bc-8d92-24100bf004d1	Dynamic Pressure (q) [Pa]	6e626a45-6872-4af8-9118-5ed4e2ba9a62	q
d26f224c-ed3e-479d-a932-336713a8950e	ace93fd1-0224-4888-af98-1670a9514b24	6e626a45-6872-4af8-9118-5ed4e2ba9a62	Drag	543d7be0-e605-4719-ba77-6aceb1b3cdeb	value
91cebb4a-24a2-4ae2-802b-86df2d7a97a8	c00515de-775c-4250-93de-9ae4075d93a8	7a777159-5c2a-4f77-b8d4-bb0556d9383e	value	7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	mprop
9f171968-cca9-42a4-bada-e1a20a8b2028	c00515de-775c-4250-93de-9ae4075d93a8	24577355-acd2-4152-9e63-609face5f63e	value	7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	ms
b6e07e7d-2473-4d2e-8c6c-a994a2b1cc18	c00515de-775c-4250-93de-9ae4075d93a8	7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	m0	be12d708-4c95-40da-95bd-8d15c3dd396e	Initial Mass (m0) [kg]
a4eec4b6-b0ab-4552-aeac-c72aedc357af	c00515de-775c-4250-93de-9ae4075d93a8	6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71	value	be12d708-4c95-40da-95bd-8d15c3dd396e	Isp [s]
e82a6388-7b31-41e4-86bd-25abb59ab27d	c00515de-775c-4250-93de-9ae4075d93a8	be12d708-4c95-40da-95bd-8d15c3dd396e	Delta-V [m/s]	53ca490f-d08a-48ed-9242-53a03749639a	Achieved_DV
d7cf5803-21bb-43a0-98d1-116613b4fe37	c00515de-775c-4250-93de-9ae4075d93a8	be12d708-4c95-40da-95bd-8d15c3dd396e	Delta-V [m/s]	7687253f-15cf-441e-b1d1-34f47f9aaeb3	value
1be30049-0925-4399-9415-2998048dca58	c00515de-775c-4250-93de-9ae4075d93a8	424eefd5-055e-43b4-b46f-80cc86a29b87	value	53ca490f-d08a-48ed-9242-53a03749639a	Target_DV
2c9b179a-3bfa-4910-ab37-8907515dc33f	c00515de-775c-4250-93de-9ae4075d93a8	53ca490f-d08a-48ed-9242-53a03749639a	Is_Feasible	5b56dfcc-aa27-4254-ac6f-93d520f96dbf	value
\.


--
-- Data for Name: folders; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.folders (id, name, parent_id, owner_name) FROM stdin;
2834f1e2-edd2-42a5-b04c-699b8fc36422	Examples	\N	\N
\.


--
-- Data for Name: nodes; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.nodes (id, sheet_id, type, label, inputs, outputs, position_x, position_y, data) FROM stdin;
b62f2c63-7cae-4ece-b516-71a4d3030e34	ace93fd1-0224-4888-af98-1670a9514b24	input	Ref Area (A) [m2]	[]	[{"key": "value"}]	100	200	{"min": "0", "description": "Reference area (usually frontal area) in m²."}
9cab3a80-f1f6-4009-999c-642561fc1054	ace93fd1-0224-4888-af98-1670a9514b24	input	Density [kg/m3]	[]	[{"key": "value"}]	100	350	{"min": "0", "description": "Air density in kg/m³."}
44f39a4e-46d5-4238-99e1-d5fd807bb575	ace93fd1-0224-4888-af98-1670a9514b24	input	Velocity [m/s]	[]	[{"key": "value"}]	100	500	{"min": "0", "description": "Velocity in m/s."}
73d69378-1295-49bc-8d92-24100bf004d1	ace93fd1-0224-4888-af98-1670a9514b24	sheet	Dynamic Pressure (q)	[{"key": "Density (rho) [kg/m3]"}, {"key": "Velocity (v) [m/s]"}]	[{"key": "Dynamic Pressure (q) [Pa]"}]	500	400	{"sheetId": "4f7d8b69-d867-4499-a8d9-b8d9c950949d"}
6e626a45-6872-4af8-9118-5ed4e2ba9a62	ace93fd1-0224-4888-af98-1670a9514b24	function	Calculate Drag	[{"key": "Cd"}, {"key": "A"}, {"key": "q"}]	[{"key": "Drag"}]	900	250	{"code": "Drag = Cd * A * q", "description": "Calculates drag force: $F_d = C_d \\\\cdot A \\\\cdot q$"}
fead2524-1454-4c31-a99f-69e0ba2138d7	4f7d8b69-d867-4499-a8d9-b8d9c950949d	input	Density (rho) [kg/m3]	[]	[{"key": "value"}]	100	100	{"min": "0", "description": "Air density in kg/m³."}
46bc26d1-21d3-4427-97cf-6af122e783f6	4f7d8b69-d867-4499-a8d9-b8d9c950949d	input	Velocity (v) [m/s]	[]	[{"key": "value"}]	100	250	{"min": "0", "description": "Velocity of the object relative to the fluid in m/s."}
e3f217d7-d2c9-486e-935c-721c9830cc1b	4f7d8b69-d867-4499-a8d9-b8d9c950949d	function	Calculate q	[{"key": "rho"}, {"key": "v"}]	[{"key": "q"}]	500	175	{"code": "q = 0.5 * rho * v**2", "description": "Calculates dynamic pressure: $q = \\\\frac{1}{2} \\\\rho v^2$"}
b3f60e06-6e81-4078-b22c-963fae221974	4f7d8b69-d867-4499-a8d9-b8d9c950949d	output	Dynamic Pressure (q) [Pa]	[{"key": "value"}]	[]	900	175	{"min": "0", "description": "Dynamic pressure in Pascals."}
b4eb1398-a183-4270-b1f2-2e86e7ebee06	ace93fd1-0224-4888-af98-1670a9514b24	input	Drag Coeff (Cd)	[]	[{"key": "value"}]	100	50	{"min": "0", "description": "Drag coefficient (dimensionless)."}
543d7be0-e605-4719-ba77-6aceb1b3cdeb	ace93fd1-0224-4888-af98-1670a9514b24	output	Drag Force [N]	[{"key": "value"}]	[]	1200	250	{"min": "0", "description": "Aerodynamic drag force in Newtons."}
5c2ca62a-2b0e-41cd-878b-aea79ac33461	07aad1cc-e750-4430-9f5a-d10883b412e3	constant	Payload Mass [kg]	[]	[{"key": "value"}]	100	100	{"max": null, "min": 0.0, "value": "2000", "options": null, "dataType": null, "description": "Mass of the payload to be delivered to orbit."}
18dd42ac-0ec2-4684-8d67-dc3ffef427e2	07aad1cc-e750-4430-9f5a-d10883b412e3	constant	Propellant Mass [kg]	[]	[{"key": "value"}]	100	260	{"max": null, "min": 0.0, "value": "93000", "options": null, "dataType": null, "description": "Mass of the propellant."}
69c45d76-5a13-4423-8676-62ab97d79e9f	07aad1cc-e750-4430-9f5a-d10883b412e3	constant	Structure Mass [kg]	[]	[{"key": "value"}]	100	400	{"max": null, "min": 0.0, "value": "5000", "options": null, "dataType": null, "description": "Mass of the rocket structure (tanks, engines, etc.)."}
bd8d64d0-a608-4af5-8522-984a807b3d3f	07aad1cc-e750-4430-9f5a-d10883b412e3	constant	Target Delta-V [m/s]	[]	[{"key": "value"}]	100	700	{"max": null, "min": 0.0, "value": "9000", "options": null, "dataType": null, "description": "Required Delta-V to reach the target orbit."}
92da5ed9-4a0d-414d-9605-5ccf98770d85	7b2d23f4-923a-4278-8f34-863d9c715fa5	constant	Material	[]	[{"key": "value"}]	100	100	{"value": "Steel", "options": ["Steel", "Aluminum", "Titanium"], "dataType": "option", "description": "Select the material for the component. This node gets its options from the connected LUT."}
d56fb6b5-40b5-4387-8a98-1ce8333267bc	7b2d23f4-923a-4278-8f34-863d9c715fa5	constant	Volume [m^3]	[]	[{"key": "value"}]	100	260	{"min": "0", "value": "1.0", "description": "Volume of the component."}
78d75c86-1fc3-4ed8-8936-af1bb32cc38d	7b2d23f4-923a-4278-8f34-863d9c715fa5	constant	Strain	[]	[{"key": "value"}]	100	400	{"min": "0", "value": "0.001", "description": "Applied strain (dimensionless)."}
65c103a6-e2df-4449-9af6-519a2cc79ad2	7b2d23f4-923a-4278-8f34-863d9c715fa5	lut	Material Properties LUT	[{"key": "key"}]	[{"key": "Density [kg/m^3]"}, {"key": "Young's Modulus [GPa]"}]	400	100	{"lut": {"rows": [{"key": "Steel", "values": {"Density [kg/m^3]": 7850, "Young's Modulus [GPa]": 210}}, {"key": "Aluminum", "values": {"Density [kg/m^3]": 2700, "Young's Modulus [GPa]": 70}}, {"key": "Titanium", "values": {"Density [kg/m^3]": 4500, "Young's Modulus [GPa]": 110}}]}, "description": "Look up density and Young's modulus based on material name."}
94bf1e8a-b089-4018-aa02-983bec869bf4	7b2d23f4-923a-4278-8f34-863d9c715fa5	function	Calculate Mass	[{"key": "density"}, {"key": "volume"}]	[{"key": "mass"}]	760	160	{"code": "mass = density * volume", "description": "Calculate mass from density and volume."}
011b0e5f-d9fa-429c-8388-1cd774198d04	07aad1cc-e750-4430-9f5a-d10883b412e3	constant	Engine Isp [s]	[]	[{"key": "value"}]	100	560	{"max": null, "min": 0.0, "value": "380", "options": null, "dataType": null, "description": "Specific Impulse of the SSTO engine."}
2dc4a3cb-f045-4315-a55c-c765a170eb84	7b2d23f4-923a-4278-8f34-863d9c715fa5	function	Calculate Stress	[{"key": "E"}, {"key": "epsilon"}]	[{"key": "stress"}]	760	360	{"code": "stress = E * epsilon", "description": "Calculate stress using Hooke's Law: $\\\\sigma = E \\\\cdot \\\\epsilon$"}
7603d9a5-442c-4d35-a64a-41b987a2e5ee	801a9982-62d3-4941-9d34-2a92b22f8e78	input	Initial Mass (m0) [kg]	[]	[{"key": "value"}]	100	260	{"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Initial total mass of the rocket (wet mass) in kg."}
cc80893a-795f-4472-881f-1627c5d2ea6b	40cb86c3-791e-4f5f-99c7-d1408acf7821	constant	Material	[]	[{"key": "value"}]	100	100	{"max": null, "min": null, "value": "Steel", "options": ["Steel", "Aluminum", "Titanium"], "dataType": "option", "description": "Select the material for the component. This node gets its options from the connected LUT."}
f33d19cc-8f19-4a4e-9db4-e11f067033fa	801a9982-62d3-4941-9d34-2a92b22f8e78	input	Final Mass (mf) [kg]	[]	[{"key": "value"}]	100	-60	{"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Final mass of the rocket (dry mass) in kg."}
e12875bc-9fba-4a57-8bde-08e33a64421d	7b2d23f4-923a-4278-8f34-863d9c715fa5	output	Mass [kg]	[{"key": "value"}]	[]	1060	160	{"min": "4000", "value": "7850", "options": [], "dataType": "any", "description": "Total mass of the component."}
20d51cc6-06ab-4bfd-afa5-d7c37fe1010a	7b2d23f4-923a-4278-8f34-863d9c715fa5	output	Stress [GPa]	[{"key": "value"}]	[]	1060	360	{"min": "0", "value": "0.21", "description": "Calculated stress based on applied strain."}
2fc1616e-0025-4622-b3f6-f776df630bbe	40cb86c3-791e-4f5f-99c7-d1408acf7821	constant	Volume [m^3]	[]	[{"key": "value"}]	100	260	{"max": null, "min": 0.0, "value": "1.0", "options": null, "dataType": null, "description": "Volume of the component."}
a155218d-32b1-4593-aed4-c6a89f730185	801a9982-62d3-4941-9d34-2a92b22f8e78	input	Isp [s]	[]	[{"key": "value"}]	100	100	{"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Specific Impulse of the engine in seconds."}
4e4ee853-526c-4a7d-85b0-ec2a4d246960	40cb86c3-791e-4f5f-99c7-d1408acf7821	constant	Strain	[]	[{"key": "value"}]	100	400	{"max": null, "min": 0.0, "value": "0.001", "options": null, "dataType": null, "description": "Applied strain (dimensionless)."}
424eefd5-055e-43b4-b46f-80cc86a29b87	c00515de-775c-4250-93de-9ae4075d93a8	constant	Target Delta-V [m/s]	[]	[{"key": "value"}]	100	700	{"max": null, "min": 0.0, "value": "9000", "options": null, "dataType": null, "description": "Required Delta-V to reach the target orbit."}
d2869ebd-f3ca-4275-8152-7ccdbe90d037	07aad1cc-e750-4430-9f5a-d10883b412e3	function	Calculate Masses	[{"key": "mp"}, {"key": "mprop"}, {"key": "ms"}]	[{"key": "m0"}, {"key": "mf"}]	400	260	{"code": "m0 = mp + mprop + ms\\nmf = mp + ms", "description": "Calculates initial (wet) and final (dry) masses."}
d994a193-8a30-4aef-a1f7-c90f3fbe3abe	07aad1cc-e750-4430-9f5a-d10883b412e3	sheet	Tsiolkovsky Rocket Equation	[{"key": "Isp [s]"}, {"key": "Initial Mass (m0) [kg]"}, {"key": "Final Mass (mf) [kg]"}]	[{"key": "Delta-V [m/s]"}]	800	400	{"sheetId": "801a9982-62d3-4941-9d34-2a92b22f8e78", "versionId": "f9d41de2-d713-4dc8-9880-c2b9386152b5", "versionTag": "v1"}
b27810ea-2318-4c05-b57f-3fbf4279f5b0	07aad1cc-e750-4430-9f5a-d10883b412e3	function	Check Feasibility	[{"key": "Achieved_DV"}, {"key": "Target_DV"}]	[{"key": "Margin"}, {"key": "Is_Feasible"}]	1200	500	{"code": "Margin = Achieved_DV - Target_DV\\nIs_Feasible = \\"YES\\" if Margin >= 0 else \\"NO\\"", "description": "Checks if the achieved Delta-V meets the target."}
3a3073ad-bb67-430e-9a81-bee436d7cd59	07aad1cc-e750-4430-9f5a-d10883b412e3	output	Achieved Delta-V	[{"key": "value"}]	[]	1600	400	{"max": null, "min": 0.0, "description": "The calculated Delta-V capability of the vehicle."}
fc3c8931-9922-461f-b40c-1d171ba65f55	1ea41c25-0883-4d12-8f72-13a6a2d1258d	constant	Gravity (g) [m/s^2]	[]	[{"key": "value"}]	100	500	{"min": "0", "value": "9.81", "description": "Acceleration due to gravity."}
dcb2527b-a122-4072-bb70-c4dfe8e91dd7	1ea41c25-0883-4d12-8f72-13a6a2d1258d	function	Calculate Trajectory	[{"key": "angle_deg"}, {"key": "v0"}, {"key": "g"}]	[{"key": "Range"}, {"key": "MaxHeight"}, {"key": "FlightTime"}]	500	300	{"code": "\\nangle_rad = math.radians(angle_deg)\\nRange = (v0**2 * math.sin(2 * angle_rad)) / g\\nMaxHeight = (v0**2 * math.sin(angle_rad)**2) / (2 * g)\\nFlightTime = (2 * v0 * math.sin(angle_rad)) / g\\n            ", "description": "Calculates Range, Max Height, and Flight Time using standard kinematic equations."}
24577355-acd2-4152-9e63-609face5f63e	c00515de-775c-4250-93de-9ae4075d93a8	constant	Structure Mass [kg]	[]	[{"key": "value"}]	100	400	{"max": null, "min": 0.0, "value": "5000", "options": null, "dataType": null, "description": "Mass of the rocket structure (tanks, engines, etc.)."}
6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71	c00515de-775c-4250-93de-9ae4075d93a8	constant	Engine Isp [s]	[]	[{"key": "value"}]	100	560	{"max": null, "min": null, "value": "380", "options": [], "dataType": "any", "description": "Specific Impulse of the SSTO engine."}
3e7a6cd1-85d3-456d-9fb2-ef49095f9e95	1ea41c25-0883-4d12-8f72-13a6a2d1258d	input	Launch Angle [deg]	[]	[{"key": "value"}]	100	100	{"max": "90", "min": "0", "description": "Angle of launch in degrees."}
d7b230bc-94cb-4882-b5ae-d7dd9ecdeda7	1ea41c25-0883-4d12-8f72-13a6a2d1258d	output	Range [m]	[{"key": "value"}]	[]	900	160	{"min": "0", "description": "Total horizontal distance traveled."}
4cba2fbf-b58e-4657-b8ae-fc4b106ffc07	1ea41c25-0883-4d12-8f72-13a6a2d1258d	input	Initial Velocity (v0) [m/s]	[]	[{"key": "value"}]	100	300	{"min": "0", "description": "Initial velocity magnitude."}
fec44be0-bd98-440a-878e-4e1b92d69f88	1ea41c25-0883-4d12-8f72-13a6a2d1258d	output	Max Height [m]	[{"key": "value"}]	[]	900	300	{"min": "0", "description": "Maximum vertical altitude reached."}
e581bc45-b26a-4690-b500-44252b434202	1ea41c25-0883-4d12-8f72-13a6a2d1258d	output	Flight Time [s]	[{"key": "value"}]	[]	900	460	{"min": "0", "description": "Total time in the air."}
b9c7700d-3233-4f1e-b349-ee90fa82e3e7	40cb86c3-791e-4f5f-99c7-d1408acf7821	function	Calculate Mass	[{"key": "density"}, {"key": "volume"}]	[{"key": "mass"}]	760	160	{"code": "mass = density * volume", "description": "Calculate mass from density and volume."}
4f44f79c-629e-4ee9-a0ad-47baa5e24d03	801a9982-62d3-4941-9d34-2a92b22f8e78	function	Calculate Delta-V	[{"key": "Isp"}, {"key": "m0"}, {"key": "mf"}]	[{"key": "DeltaV"}]	500	260	{"code": "g0 = 9.80665\\nDeltaV = Isp * g0 * math.log(m0 / mf)", "description": "Calculates the Delta-V using the Tsiolkovsky rocket equation: \\n$$\\n\\\\Delta V = I_{sp} g_0 \\\\ln(\\\\frac{m_0}{m_f})\\n$$\\n\\n![Attachment](/attachments/225904f0-afaf-4ff0-a758-1ed3c9d60fd5_Tsiolkovsky's_Theoretical_Rocket_Diagram.png)"}
b20f8fd9-ebf5-4f83-a90f-4e20fcdb4d23	07aad1cc-e750-4430-9f5a-d10883b412e3	output	Margin [m/s]	[{"key": "value"}]	[]	1600	560	{"max": null, "min": 0.0, "description": "Excess Delta-V available (or deficit if negative)."}
e61b17ac-bc56-450f-9aab-a0804fabf31d	40cb86c3-791e-4f5f-99c7-d1408acf7821	function	Calculate Stress	[{"key": "E"}, {"key": "epsilon"}]	[{"key": "stress"}]	760	360	{"code": "stress = E * epsilon", "description": "Calculate stress using Hooke's Law: $\\\\sigma = E \\\\cdot \\\\epsilon$"}
27d6c8b5-ae5c-4045-87b7-bd646766529c	40cb86c3-791e-4f5f-99c7-d1408acf7821	output	Mass [kg]	[{"key": "value"}]	[]	1060	160	{"max": null, "min": 0.0, "description": "Total mass of the component."}
416a4570-1d1d-4e97-bdfa-b98e2920d34c	07aad1cc-e750-4430-9f5a-d10883b412e3	output	Feasible?	[{"key": "value"}]	[]	1600	700	{"max": null, "min": null, "description": "Boolean-like string indicating if the mission is feasible."}
f4f395d0-94a4-431d-8da9-dd0bff081a79	801a9982-62d3-4941-9d34-2a92b22f8e78	output	Delta-V [m/s]	[{"key": "value"}]	[]	900	260	{"max": null, "min": 0.0, "description": "The total change in velocity achievable by the rocket."}
02ae42c2-e586-4013-8478-750b78ddff85	c00515de-775c-4250-93de-9ae4075d93a8	constant	Payload Mass [kg]	[]	[{"key": "value"}]	100	100	{"max": null, "min": 0.0, "value": "2000", "options": null, "dataType": null, "description": "Mass of the payload to be delivered to orbit."}
7a777159-5c2a-4f77-b8d4-bb0556d9383e	c00515de-775c-4250-93de-9ae4075d93a8	constant	Propellant Mass [kg]	[]	[{"key": "value"}]	100	260	{"max": null, "min": 0.0, "value": "93000", "options": null, "dataType": null, "description": "Mass of the propellant."}
943cc7e4-86d7-447a-9eb1-8159516a0d8f	b51ea955-b1c8-4cf1-8991-87858995a4e9	sheet	SSTO Feasibility Check (Copy)	[]	[{"key": "Engine Isp [s]"}, {"key": "Payload Mass [kg]"}, {"key": "Propellant Mass [kg]"}, {"key": "Structure Mass [kg]"}, {"key": "Target Delta-V [m/s]"}, {"key": "Achieved Delta-V"}, {"key": "Feasible?"}]	0	0	{"sheetId": "c00515de-775c-4250-93de-9ae4075d93a8", "versionId": null, "versionTag": null}
4e056a2f-7c98-4226-9fbc-6847ac7b3748	40cb86c3-791e-4f5f-99c7-d1408acf7821	lut	Material Properties LUT	[{"key": "key"}]	[{"key": "Density [kg/m^3]"}, {"key": "Young's Modulus [GPa]"}]	400	100	{"lut": {"rows": [{"key": "Steel", "values": {"Density [kg/m^3]": 7850, "Young's Modulus [GPa]": 210}}, {"key": "Aluminum", "values": {"Density [kg/m^3]": 2700, "Young's Modulus [GPa]": 70}}, {"key": "Titanium", "values": {"Density [kg/m^3]": 4500, "Young's Modulus [GPa]": 110}}]}, "description": "Look up density and Young's modulus based on material name."}
7e83274d-8e58-493f-9c6f-51a1f4a9b9fa	c00515de-775c-4250-93de-9ae4075d93a8	function	Calculate Masses	[{"key": "mp"}, {"key": "mprop"}, {"key": "ms"}]	[{"key": "m0"}, {"key": "mf"}]	500	180	{"code": "m0 = mp + mprop + ms\\nmf = mp + ms", "description": "Calculates initial (wet) and final (dry) masses."}
be12d708-4c95-40da-95bd-8d15c3dd396e	c00515de-775c-4250-93de-9ae4075d93a8	sheet	Tsiolkovsky Rocket Equation	[{"key": "Final Mass (mf) [kg]"}, {"key": "Initial Mass (m0) [kg]"}, {"key": "Isp [s]"}]	[{"key": "Delta-V [m/s]"}]	840	180	{"sheetId": "801a9982-62d3-4941-9d34-2a92b22f8e78", "versionId": null, "versionTag": null}
53ca490f-d08a-48ed-9242-53a03749639a	c00515de-775c-4250-93de-9ae4075d93a8	function	Check Feasibility	[{"key": "Achieved_DV"}, {"key": "Target_DV"}]	[{"key": "Margin"}, {"key": "Is_Feasible"}]	1200	500	{"code": "Margin = Achieved_DV - Target_DV\\nIs_Feasible = \\"YES\\" if Margin >= 0 else \\"NO\\"", "description": "Checks if the achieved Delta-V meets the target."}
86e98a98-a08f-441f-8aa3-e9d109dfc07b	40cb86c3-791e-4f5f-99c7-d1408acf7821	output	Stress [GPa]	[{"key": "value"}]	[]	1060	360	{"max": null, "min": 0.0, "description": "Calculated stress based on applied strain."}
3a0783f8-2cab-4112-8588-a81782140a6c	b50f13d4-c408-4963-aea3-42405427cfcf	constant	Constant	[]	[{"key": "value"}]	0	0	{"max": null, "min": null, "value": 0, "options": [], "dataType": "any", "description": null}
7687253f-15cf-441e-b1d1-34f47f9aaeb3	c00515de-775c-4250-93de-9ae4075d93a8	output	Achieved Delta-V	[{"key": "value"}, {"key": "min"}]	[]	1600	400	{"max": null, "min": null, "description": "The calculated Delta-V capability of the vehicle."}
5b56dfcc-aa27-4254-ac6f-93d520f96dbf	c00515de-775c-4250-93de-9ae4075d93a8	output	Feasible?	[{"key": "value"}]	[]	1600	700	{"max": null, "min": null, "description": "Boolean-like string indicating if the mission is feasible."}
\.


--
-- Data for Name: sheet_locks; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.sheet_locks (sheet_id, user_id, tab_id, acquired_at, last_heartbeat_at, last_save_at) FROM stdin;
c00515de-775c-4250-93de-9ae4075d93a8	Test User	466ffdb8-16d7-4a67-8d99-8ccad6b835c2	2026-02-10 05:47:40.339073	2026-02-10 05:57:10.606565	\N
\.


--
-- Data for Name: sheet_versions; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.sheet_versions (id, sheet_id, version_tag, description, data, created_at, created_by) FROM stdin;
ee48f245-af4a-4015-b04f-3394d36ae659	c00515de-775c-4250-93de-9ae4075d93a8	hogei		{"nodes": [{"id": "24577355-acd2-4152-9e63-609face5f63e", "data": {"min": "0", "value": "5000", "description": "Mass of the rocket structure (tanks, engines, etc.)."}, "type": "constant", "label": "Structure Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 400.0}, {"id": "6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71", "data": {"min": "0", "value": "380", "description": "Specific Impulse of the SSTO engine."}, "type": "constant", "label": "Engine Isp [s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 560.0}, {"id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "data": {"min": "0", "value": "9000", "description": "Required Delta-V to reach the target orbit."}, "type": "constant", "label": "Target Delta-V [m/s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 700.0}, {"id": "02ae42c2-e586-4013-8478-750b78ddff85", "data": {"min": "0", "value": "2000", "description": "Mass of the payload to be delivered to orbit."}, "type": "constant", "label": "Payload Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 100.0}, {"id": "7a777159-5c2a-4f77-b8d4-bb0556d9383e", "data": {"min": "0", "value": "93000", "description": "Mass of the propellant."}, "type": "constant", "label": "Propellant Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 260.0}, {"id": "53ca490f-d08a-48ed-9242-53a03749639a", "data": {"code": "Margin = Achieved_DV - Target_DV\\nIs_Feasible = \\"YES\\" if Margin >= 0 else \\"NO\\"", "description": "Checks if the achieved Delta-V meets the target."}, "type": "function", "label": "Check Feasibility", "inputs": [{"key": "Achieved_DV"}, {"key": "Target_DV"}], "outputs": [{"key": "Margin"}, {"key": "Is_Feasible"}], "position_x": 1200.0, "position_y": 500.0}, {"id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "data": {"value": "9909.804327650992", "options": [], "dataType": "any", "description": "The calculated Delta-V capability of the vehicle."}, "type": "output", "label": "Achieved Delta-V", "inputs": [{"key": "value"}, {"key": "min"}], "outputs": [], "position_x": 1600.0, "position_y": 400.0}, {"id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf", "data": {"value": "YES", "options": ["YES", "NO"], "dataType": "option", "description": "Boolean-like string indicating if the mission is feasible."}, "type": "output", "label": "Feasible?", "inputs": [{"key": "value"}], "outputs": [], "position_x": 1600.0, "position_y": 700.0}, {"id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "data": {"code": "m0 = mp + mprop + ms\\nmf = mp + ms", "description": "Calculates initial (wet) and final (dry) masses."}, "type": "function", "label": "Calculate Masses", "inputs": [{"key": "mp"}, {"key": "mprop"}, {"key": "ms"}], "outputs": [{"key": "m0"}, {"key": "mf"}], "position_x": 400.0, "position_y": 260.0}, {"id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "data": {"sheetId": "801a9982-62d3-4941-9d34-2a92b22f8e78"}, "type": "sheet", "label": "Tsiolkovsky Rocket Equation", "inputs": [{"key": "Isp [s]"}, {"key": "Initial Mass (m0) [kg]"}, {"key": "Final Mass (mf) [kg]"}], "outputs": [{"key": "Delta-V [m/s]"}], "position_x": 800.0, "position_y": 400.0}], "connections": [{"id": "ea6a4c4e-f520-4f56-816b-647b202196a0", "source_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "mf", "target_port": "Final Mass (mf) [kg]"}, {"id": "8d8b3bf4-7fbd-476a-b10e-34702d03f648", "source_id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "target_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "source_port": "value", "target_port": "min"}, {"id": "a5854992-3950-4b42-b2b5-e2a297519301", "source_id": "02ae42c2-e586-4013-8478-750b78ddff85", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "mp"}, {"id": "b98e7f88-b7c2-4be1-b4ce-4b052fbb912d", "source_id": "7a777159-5c2a-4f77-b8d4-bb0556d9383e", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "mprop"}, {"id": "c016ea47-2142-491a-9b73-425e9e427af4", "source_id": "24577355-acd2-4152-9e63-609face5f63e", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "ms"}, {"id": "3f741c62-b2d7-4952-88f1-1b59e5434044", "source_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "m0", "target_port": "Initial Mass (m0) [kg]"}, {"id": "94cc8fc0-86e6-4daf-9670-a00f44cdf2d0", "source_id": "6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "value", "target_port": "Isp [s]"}, {"id": "0903aa74-cc0c-419d-8826-f32f7c12a87a", "source_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "target_id": "53ca490f-d08a-48ed-9242-53a03749639a", "source_port": "Delta-V [m/s]", "target_port": "Achieved_DV"}, {"id": "06432ca6-a562-4cdd-a6ac-f491d37c6473", "source_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "target_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "source_port": "Delta-V [m/s]", "target_port": "value"}, {"id": "c8972228-44fc-42a3-a57b-21d74a82e8b9", "source_id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "target_id": "53ca490f-d08a-48ed-9242-53a03749639a", "source_port": "value", "target_port": "Target_DV"}, {"id": "61c65220-d79e-44af-a4df-1d2064fc2695", "source_id": "53ca490f-d08a-48ed-9242-53a03749639a", "target_id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf", "source_port": "Is_Feasible", "target_port": "value"}]}	2026-01-24 13:36:15.157157	Test User
f9d41de2-d713-4dc8-9880-c2b9386152b5	801a9982-62d3-4941-9d34-2a92b22f8e78	v1		{"nodes": [{"id": "a155218d-32b1-4593-aed4-c6a89f730185", "data": {"min": "0", "description": "Specific Impulse of the engine in seconds."}, "type": "input", "label": "Isp [s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 100.0}, {"id": "7603d9a5-442c-4d35-a64a-41b987a2e5ee", "data": {"min": "0", "description": "Initial total mass of the rocket (wet mass) in kg."}, "type": "input", "label": "Initial Mass (m0) [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 250.0}, {"id": "f33d19cc-8f19-4a4e-9db4-e11f067033fa", "data": {"min": "0", "description": "Final mass of the rocket (dry mass) in kg."}, "type": "input", "label": "Final Mass (mf) [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 400.0}, {"id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "data": {"code": "g0 = 9.80665\\nDeltaV = Isp * g0 * math.log(m0 / mf)", "attachment": "225904f0-afaf-4ff0-a758-1ed3c9d60fd5_Tsiolkovsky's_Theoretical_Rocket_Diagram.png", "description": "Calculates the Delta-V using the Tsiolkovsky rocket equation: \\n$$\\n\\\\Delta V = I_{sp} g_0 \\\\ln(\\\\frac{m_0}{m_f})\\n$$\\n\\n![Attachment](/attachments/225904f0-afaf-4ff0-a758-1ed3c9d60fd5_Tsiolkovsky's_Theoretical_Rocket_Diagram.png)"}, "type": "function", "label": "Calculate Delta-V", "inputs": [{"key": "Isp"}, {"key": "m0"}, {"key": "mf"}], "outputs": [{"key": "DeltaV"}], "position_x": 500.0, "position_y": 250.0}, {"id": "f4f395d0-94a4-431d-8da9-dd0bff081a79", "data": {"min": "0", "description": "The total change in velocity achievable by the rocket."}, "type": "output", "label": "Delta-V [m/s]", "inputs": [{"key": "value"}], "outputs": [], "position_x": 900.0, "position_y": 250.0}], "connections": [{"id": "b405335e-2049-4f83-8ebb-2fc7a3f0585a", "source_id": "a155218d-32b1-4593-aed4-c6a89f730185", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "Isp"}, {"id": "0caf0277-500d-4a85-9206-fa6051038e2e", "source_id": "7603d9a5-442c-4d35-a64a-41b987a2e5ee", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "m0"}, {"id": "8b3733cf-1d79-4616-9d55-a55733611bb4", "source_id": "f33d19cc-8f19-4a4e-9db4-e11f067033fa", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "mf"}, {"id": "451c3250-c1db-48b0-af30-c25701f969d0", "source_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "target_id": "f4f395d0-94a4-431d-8da9-dd0bff081a79", "source_port": "DeltaV", "target_port": "value"}]}	2026-01-29 07:40:00.806602	Test User
a21c535f-2767-4b7b-afce-0e1e7c8bbdd5	801a9982-62d3-4941-9d34-2a92b22f8e78	eee		{"nodes": [{"id": "a155218d-32b1-4593-aed4-c6a89f730185", "data": {"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Specific Impulse of the engine in seconds."}, "type": "input", "label": "Isp [s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 100.0}, {"id": "7603d9a5-442c-4d35-a64a-41b987a2e5ee", "data": {"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Initial total mass of the rocket (wet mass) in kg."}, "type": "input", "label": "Initial Mass (m0) [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 260.0}, {"id": "f33d19cc-8f19-4a4e-9db4-e11f067033fa", "data": {"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Final mass of the rocket (dry mass) in kg."}, "type": "input", "label": "Final Mass (mf) [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 400.0}, {"id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "data": {"code": "g0 = 9.80665\\nDeltaV = Isp * g0 * math.log(m0 / mf)", "description": "Calculates the Delta-V using the Tsiolkovsky rocket equation: \\n$$\\n\\\\Delta V = I_{sp} g_0 \\\\ln(\\\\frac{m_0}{m_f})\\n$$\\n\\n![Attachment](/attachments/225904f0-afaf-4ff0-a758-1ed3c9d60fd5_Tsiolkovsky's_Theoretical_Rocket_Diagram.png)"}, "type": "function", "label": "Calculate Delta-V", "inputs": [{"key": "Isp"}, {"key": "m0"}, {"key": "mf"}], "outputs": [{"key": "DeltaV"}], "position_x": 500.0, "position_y": 260.0}, {"id": "27410c0c-cff3-449d-95ed-9bf85b224aaa", "data": {"max": null, "min": 0.0, "options": null, "dataType": null, "description": "Final mass of the rocket (dry mass) in kg."}, "type": "input", "label": "Final Mass (mf) [kg] (1)", "inputs": [], "outputs": [{"key": "value"}], "position_x": 160.0, "position_y": 560.0}, {"id": "f4f395d0-94a4-431d-8da9-dd0bff081a79", "data": {"max": null, "min": 0.0, "description": "The total change in velocity achievable by the rocket."}, "type": "output", "label": "Delta-V [m/s]", "inputs": [{"key": "value"}], "outputs": [], "position_x": 900.0, "position_y": 260.0}], "connections": [{"id": "61937da2-f022-41de-ab09-11e576a0e451", "source_id": "a155218d-32b1-4593-aed4-c6a89f730185", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "Isp"}, {"id": "012d7611-54d0-4809-b1f5-2c34f7d8298c", "source_id": "7603d9a5-442c-4d35-a64a-41b987a2e5ee", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "m0"}, {"id": "70b00ec1-c845-457e-8846-c30f981fda5d", "source_id": "f33d19cc-8f19-4a4e-9db4-e11f067033fa", "target_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "source_port": "value", "target_port": "mf"}, {"id": "15530066-71d2-4f14-832a-0a970cb9c104", "source_id": "4f44f79c-629e-4ee9-a0ad-47baa5e24d03", "target_id": "f4f395d0-94a4-431d-8da9-dd0bff081a79", "source_port": "DeltaV", "target_port": "value"}]}	2026-02-04 05:49:51.205051	Test User
f6766fbc-b7d0-44fa-bbc1-4204618042f8	c00515de-775c-4250-93de-9ae4075d93a8	neko		{"nodes": [{"id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "data": {"max": null, "min": 0.0, "value": "9000", "options": null, "dataType": null, "description": "Required Delta-V to reach the target orbit."}, "type": "constant", "label": "Target Delta-V [m/s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 700.0}, {"id": "24577355-acd2-4152-9e63-609face5f63e", "data": {"max": null, "min": 0.0, "value": "5000", "options": null, "dataType": null, "description": "Mass of the rocket structure (tanks, engines, etc.)."}, "type": "constant", "label": "Structure Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 400.0}, {"id": "6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71", "data": {"max": null, "min": null, "value": "380", "options": [], "dataType": "any", "description": "Specific Impulse of the SSTO engine."}, "type": "constant", "label": "Engine Isp [s]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 560.0}, {"id": "02ae42c2-e586-4013-8478-750b78ddff85", "data": {"max": null, "min": 0.0, "value": "2000", "options": null, "dataType": null, "description": "Mass of the payload to be delivered to orbit."}, "type": "constant", "label": "Payload Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 100.0}, {"id": "7a777159-5c2a-4f77-b8d4-bb0556d9383e", "data": {"max": null, "min": 0.0, "value": "93000", "options": null, "dataType": null, "description": "Mass of the propellant."}, "type": "constant", "label": "Propellant Mass [kg]", "inputs": [], "outputs": [{"key": "value"}], "position_x": 100.0, "position_y": 260.0}, {"id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "data": {"code": "m0 = mp + mprop + ms\\nmf = mp + ms", "description": "Calculates initial (wet) and final (dry) masses."}, "type": "function", "label": "Calculate Masses", "inputs": [{"key": "mp"}, {"key": "mprop"}, {"key": "ms"}], "outputs": [{"key": "m0"}, {"key": "mf"}], "position_x": 500.0, "position_y": 180.0}, {"id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "data": {"sheetId": "801a9982-62d3-4941-9d34-2a92b22f8e78", "versionId": null, "versionTag": null}, "type": "sheet", "label": "Tsiolkovsky Rocket Equation", "inputs": [{"key": "Final Mass (mf) [kg]"}, {"key": "Initial Mass (m0) [kg]"}, {"key": "Isp [s]"}], "outputs": [{"key": "Delta-V [m/s]"}], "position_x": 840.0, "position_y": 180.0}, {"id": "53ca490f-d08a-48ed-9242-53a03749639a", "data": {"code": "Margin = Achieved_DV - Target_DV\\nIs_Feasible = \\"YES\\" if Margin >= 0 else \\"NO\\"", "description": "Checks if the achieved Delta-V meets the target."}, "type": "function", "label": "Check Feasibility", "inputs": [{"key": "Achieved_DV"}, {"key": "Target_DV"}], "outputs": [{"key": "Margin"}, {"key": "Is_Feasible"}], "position_x": 1200.0, "position_y": 500.0}, {"id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "data": {"max": null, "min": null, "description": "The calculated Delta-V capability of the vehicle."}, "type": "output", "label": "Achieved Delta-V", "inputs": [{"key": "value"}, {"key": "min"}], "outputs": [], "position_x": 1600.0, "position_y": 400.0}, {"id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf", "data": {"max": null, "min": null, "description": "Boolean-like string indicating if the mission is feasible."}, "type": "output", "label": "Feasible?", "inputs": [{"key": "value"}], "outputs": [], "position_x": 1600.0, "position_y": 700.0}], "connections": [{"id": "389985e4-dcf4-4368-8ef9-e1d90a597e41", "source_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "mf", "target_port": "Final Mass (mf) [kg]"}, {"id": "735bcbff-2b82-4633-8dea-25c34716b43f", "source_id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "target_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "source_port": "value", "target_port": "min"}, {"id": "2e92a302-2c30-492a-beb1-55fc3d76adbc", "source_id": "02ae42c2-e586-4013-8478-750b78ddff85", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "mp"}, {"id": "91cebb4a-24a2-4ae2-802b-86df2d7a97a8", "source_id": "7a777159-5c2a-4f77-b8d4-bb0556d9383e", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "mprop"}, {"id": "9f171968-cca9-42a4-bada-e1a20a8b2028", "source_id": "24577355-acd2-4152-9e63-609face5f63e", "target_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "source_port": "value", "target_port": "ms"}, {"id": "b6e07e7d-2473-4d2e-8c6c-a994a2b1cc18", "source_id": "7e83274d-8e58-493f-9c6f-51a1f4a9b9fa", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "m0", "target_port": "Initial Mass (m0) [kg]"}, {"id": "a4eec4b6-b0ab-4552-aeac-c72aedc357af", "source_id": "6a0a4eb1-5985-429f-8d5f-6e5a5c7b0a71", "target_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "source_port": "value", "target_port": "Isp [s]"}, {"id": "e82a6388-7b31-41e4-86bd-25abb59ab27d", "source_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "target_id": "53ca490f-d08a-48ed-9242-53a03749639a", "source_port": "Delta-V [m/s]", "target_port": "Achieved_DV"}, {"id": "d7cf5803-21bb-43a0-98d1-116613b4fe37", "source_id": "be12d708-4c95-40da-95bd-8d15c3dd396e", "target_id": "7687253f-15cf-441e-b1d1-34f47f9aaeb3", "source_port": "Delta-V [m/s]", "target_port": "value"}, {"id": "1be30049-0925-4399-9415-2998048dca58", "source_id": "424eefd5-055e-43b4-b46f-80cc86a29b87", "target_id": "53ca490f-d08a-48ed-9242-53a03749639a", "source_port": "value", "target_port": "Target_DV"}, {"id": "2c9b179a-3bfa-4910-ab37-8907515dc33f", "source_id": "53ca490f-d08a-48ed-9242-53a03749639a", "target_id": "5b56dfcc-aa27-4254-ac6f-93d520f96dbf", "source_port": "Is_Feasible", "target_port": "value"}]}	2026-02-06 04:37:42.968518	Test User
\.


--
-- Data for Name: sheets; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.sheets (id, name, owner_name, folder_id, default_version_id) FROM stdin;
4f7d8b69-d867-4499-a8d9-b8d9c950949d	Dynamic Pressure (q)	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
ace93fd1-0224-4888-af98-1670a9514b24	Aerodynamic Drag Force	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
07aad1cc-e750-4430-9f5a-d10883b412e3	SSTO Feasibility Check	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
40cb86c3-791e-4f5f-99c7-d1408acf7821	Material Selection Example	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
1ea41c25-0883-4d12-8f72-13a6a2d1258d	Projectile Motion (2D Sweep)	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
7b2d23f4-923a-4278-8f34-863d9c715fa5	Material Selection Example (Copy)	System	\N	\N
c00515de-775c-4250-93de-9ae4075d93a8	SSTO Feasibility Check (Copy)	System	\N	ee48f245-af4a-4015-b04f-3394d36ae659
801a9982-62d3-4941-9d34-2a92b22f8e78	Tsiolkovsky Rocket Equation	System	2834f1e2-edd2-42a5-b04c-699b8fc36422	f9d41de2-d713-4dc8-9880-c2b9386152b5
b50f13d4-c408-4963-aea3-42405427cfcf	Untitled Sheet 1769761987979	Test User	2834f1e2-edd2-42a5-b04c-699b8fc36422	\N
b51ea955-b1c8-4cf1-8991-87858995a4e9	Untitled Sheet 1770358038675	Test User	\N	\N
\.


--
-- Data for Name: user_read_states; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.user_read_states (user_name, sheet_id, last_read_at) FROM stdin;
Test User	801a9982-62d3-4941-9d34-2a92b22f8e78	2026-02-06 03:35:32.812538
Test User	c00515de-775c-4250-93de-9ae4075d93a8	2026-02-06 04:37:18.986337
Test User	b51ea955-b1c8-4cf1-8991-87858995a4e9	2026-02-06 06:07:27.034172
Test User	1ea41c25-0883-4d12-8f72-13a6a2d1258d	2026-01-23 04:42:12.263565
Test User	7b2d23f4-923a-4278-8f34-863d9c715fa5	2026-01-24 12:34:00.620435
Test User	b50f13d4-c408-4963-aea3-42405427cfcf	2026-01-30 08:34:22.945455
Test User	40cb86c3-791e-4f5f-99c7-d1408acf7821	2026-02-03 15:02:52.224217
Test User	07aad1cc-e750-4430-9f5a-d10883b412e3	2026-02-04 06:43:48.366935
\.


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: nodes nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_pkey PRIMARY KEY (id);


--
-- Name: sheet_locks sheet_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheet_locks
    ADD CONSTRAINT sheet_locks_pkey PRIMARY KEY (sheet_id);


--
-- Name: sheet_versions sheet_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheet_versions
    ADD CONSTRAINT sheet_versions_pkey PRIMARY KEY (id);


--
-- Name: sheets sheets_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_pkey PRIMARY KEY (id);


--
-- Name: user_read_states user_read_states_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_read_states
    ADD CONSTRAINT user_read_states_pkey PRIMARY KEY (user_name, sheet_id);


--
-- Name: ix_audit_logs_sheet_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_audit_logs_sheet_id ON public.audit_logs USING btree (sheet_id);


--
-- Name: ix_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: ix_audit_logs_user_name; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_audit_logs_user_name ON public.audit_logs USING btree (user_name);


--
-- Name: ix_folders_name; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_folders_name ON public.folders USING btree (name);


--
-- Name: ix_sheet_versions_sheet_id; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_sheet_versions_sheet_id ON public.sheet_versions USING btree (sheet_id);


--
-- Name: ix_sheet_versions_version_tag; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_sheet_versions_version_tag ON public.sheet_versions USING btree (version_tag);


--
-- Name: ix_sheets_name; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX ix_sheets_name ON public.sheets USING btree (name);


--
-- Name: audit_logs audit_logs_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;


--
-- Name: connections connections_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);


--
-- Name: connections connections_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.nodes(id);


--
-- Name: connections connections_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.nodes(id);


--
-- Name: folders folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.folders
    ADD CONSTRAINT folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.folders(id);


--
-- Name: nodes nodes_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id);


--
-- Name: sheet_locks sheet_locks_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheet_locks
    ADD CONSTRAINT sheet_locks_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;


--
-- Name: sheet_versions sheet_versions_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheet_versions
    ADD CONSTRAINT sheet_versions_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;


--
-- Name: sheets sheets_default_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_default_version_id_fkey FOREIGN KEY (default_version_id) REFERENCES public.sheet_versions(id) ON DELETE SET NULL;


--
-- Name: sheets sheets_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.sheets
    ADD CONSTRAINT sheets_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id);


--
-- Name: user_read_states user_read_states_sheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.user_read_states
    ADD CONSTRAINT user_read_states_sheet_id_fkey FOREIGN KEY (sheet_id) REFERENCES public.sheets(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict JoKcvap2rCFD39PaET3yd9img43c7doZdhgbLmGzGj8PL7t8WwYacZhGx78sLUd

