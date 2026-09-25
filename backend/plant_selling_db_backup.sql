--
-- PostgreSQL database dump
--

\restrict ImN6tbjlrX9OP1BhBHeooy8WdxRk4t6MsbbSWOvJNb2RRphOwbmPjRInwqIzZk5

-- Dumped from database version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-0ubuntu0.26.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'PENDING',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'CUSTOMER',
    'VENDOR',
    'ADMIN'
);


ALTER TYPE public."Role" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id text NOT NULL,
    user_id text NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    postal_code text
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cart_items (
    id text NOT NULL,
    cart_id text NOT NULL,
    product_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.cart_items OWNER TO postgres;

--
-- Name: carts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.carts (
    id text NOT NULL,
    user_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.carts OWNER TO postgres;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    order_id text NOT NULL,
    product_id text,
    quantity integer NOT NULL,
    price numeric(10,2) NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id text NOT NULL,
    user_id text NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status public."OrderStatus" DEFAULT 'PENDING'::public."OrderStatus" NOT NULL,
    order_date timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id text NOT NULL,
    order_id text NOT NULL,
    payment_method text NOT NULL,
    payment_status text DEFAULT 'PENDING'::text NOT NULL,
    transaction_id text
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id text NOT NULL,
    product_id text NOT NULL,
    image_url text NOT NULL
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id text NOT NULL,
    vendor_id text NOT NULL,
    category_id text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id text NOT NULL,
    user_id text NOT NULL,
    product_id text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    comment text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role public."Role" DEFAULT 'CUSTOMER'::public."Role" NOT NULL,
    phone text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id text NOT NULL,
    user_id text NOT NULL,
    store_name text NOT NULL,
    description text,
    verification_status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: wishlists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wishlists (
    id text NOT NULL,
    user_id text NOT NULL,
    product_id text NOT NULL
);


ALTER TABLE public.wishlists OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
684b4c8a-0d63-4d93-911c-a61f0dd39eba	840fa28e027dc3edd4dd792c2c96987fccc8b1bb25ae2b0f46162ad0dedc1587	2026-08-01 10:55:45.502888+05:45	20260801051045_init	\N	\N	2026-08-01 10:55:45.455394+05:45	1
\.


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.addresses (id, user_id, address, city, postal_code) FROM stdin;
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cart_items (id, cart_id, product_id, quantity) FROM stdin;
dceee070-750c-4917-a994-487f5c445dfd	e5664b26-c9ff-4fd3-b59d-8c4253bcc5fc	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1
250d9600-0c72-4035-81c6-644d659258a5	e5664b26-c9ff-4fd3-b59d-8c4253bcc5fc	049c4212-3d52-47a0-82db-d383c288d636	1
ddbe98bd-5f00-416c-8186-187ae0d00866	e5664b26-c9ff-4fd3-b59d-8c4253bcc5fc	826fbbbc-25ad-4c95-8f14-a56fe1ebb0e3	1
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.carts (id, user_id, created_at) FROM stdin;
e5664b26-c9ff-4fd3-b59d-8c4253bcc5fc	1733c375-44dd-419e-bdaf-7f3a95e6f801	2026-08-01 05:23:40.589
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, name, description, created_at, updated_at) FROM stdin;
71ee144b-d741-4869-bc53-66a043c97ebc	Flowering Plants	Plants that produce beautiful flowers	2026-08-01 05:23:40.367	2026-08-01 05:23:40.367
31421913-b88b-4686-8dfd-dd410a06d955	Succulents & Cacti	Drought-tolerant plants with fleshy leaves	2026-08-01 05:23:40.373	2026-08-01 05:23:40.373
ff520373-a7e9-4397-983a-50e374df84c1	Herbs & Edibles	Culinary and medicinal herbs	2026-08-01 05:23:40.377	2026-08-01 05:23:40.377
c867c210-b269-4a35-bc12-d1891da065cc	Ferns & Foliage	Grown primarily for their attractive leaves	2026-08-01 05:23:40.379	2026-08-01 05:23:40.379
235bde91-7a54-4350-8e9f-7fa4d1ca0943	Indoor Trees & Palms	Larger plants that add drama to indoor spaces	2026-08-01 05:23:40.383	2026-08-01 05:23:40.383
3febcc3d-9c9d-4974-90ae-e568e5420e76	Outdoor Plants	For outdoor plants	2026-08-05 16:09:48.623	2026-08-05 16:09:48.623
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, quantity, price) FROM stdin;
84592cf5-e024-4397-b9a9-492cece897bf	e1d2e199-442b-47ca-8432-2fe597d0ce76	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
dfe555b1-f5c1-4ddd-b6af-a51efcedf109	9a123f9f-5546-4449-982e-a18104b2e95d	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
dba5e31b-a9d2-40b2-972c-5dd9e99315d0	ed5a7316-a543-4656-8e82-9d5ed2ec95df	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
bbf4f538-f5a3-44af-9445-6a51b9e603b8	4c995752-7388-4887-ad28-f7870393ba1d	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
9993ee2b-b763-42b5-9e51-55a5208026e2	15e23b29-87a2-447f-b8e7-9848703abdde	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
f96aec9a-14b0-4142-96a6-a9f76dfec4be	b1dca789-cecf-47ef-ae0e-b6abe277ed54	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
282e0ef8-7032-422b-9d86-6c951cc4b3e3	e68d81c0-d1ce-45d6-a1b9-65077823762f	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
5bbc5abb-1d58-49e1-a147-cfb245d9f8c4	36790da1-d126-438d-9f8d-c294072f3e28	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
b6c7a1c4-96b6-4d69-bed3-9425fae66473	12269f7e-2abf-41c4-bdd5-54fdc7877264	\N	1	1200.00
5da49e07-1b7e-4222-aeb5-e9e7305ee831	20b7e6a1-ec80-4e6d-8005-d87d0bf47a3f	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
ab9e50d7-d1b1-47d3-b306-791067e1efe4	2fcccce1-e754-4367-9b4c-591839b5c48e	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
bad5e625-e38d-4dfc-bca0-9b9113973394	28688182-598b-41ad-9bf6-29dc802b0704	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
3e8f0b63-fca8-4442-8eab-566cbf7cdf39	cbec9ea7-daf6-4898-8119-57372dad053e	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
c7765704-d8e4-4d8d-86b0-bcd1aead0444	da6e7da4-0159-4c6f-9a9e-6ac1a9adf88d	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
7c1b8010-157c-4c6d-977d-e53b3d2409cf	b67ba708-ac8e-4df9-846c-d794da36ab92	7779a37c-32ad-4cbc-9060-546160ed3371	1	650.00
db95f227-6222-460a-bb35-840a276cb5cf	1e8cb8f7-c6b0-46c0-bcf5-c17b98a1f43e	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
3c729809-973a-4142-b9b1-15fa6854c887	e72091a8-0e3f-4750-8d25-14d1c1f779fa	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	1	299.00
988fb4cb-ec81-4578-88a7-49a6dabb83b6	b01d7f38-3b9f-4c51-96b3-e3bdb25d19be	049c4212-3d52-47a0-82db-d383c288d636	1	899.00
fbb77c74-567c-44ca-87d8-f4df66838ab0	a994c575-5474-4b60-81d5-a0f088924e5f	826fbbbc-25ad-4c95-8f14-a56fe1ebb0e3	1	2499.00
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, user_id, total_amount, status, order_date, created_at, updated_at) FROM stdin;
b1dca789-cecf-47ef-ae0e-b6abe277ed54	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-08 11:44:41.121	2026-08-08 11:44:41.121	2026-08-08 11:44:41.121
e68d81c0-d1ce-45d6-a1b9-65077823762f	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-08 11:59:44.994	2026-08-08 11:59:44.994	2026-08-08 11:59:44.994
36790da1-d126-438d-9f8d-c294072f3e28	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-08 12:00:16.189	2026-08-08 12:00:16.189	2026-08-08 12:00:16.189
12269f7e-2abf-41c4-bdd5-54fdc7877264	1733c375-44dd-419e-bdaf-7f3a95e6f801	1200.00	SHIPPED	2026-08-08 12:01:03	2026-08-08 12:01:03	2026-08-09 11:36:03.759
20b7e6a1-ec80-4e6d-8005-d87d0bf47a3f	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:38:09.778	2026-08-09 11:38:09.778	2026-08-09 11:38:09.778
2fcccce1-e754-4367-9b4c-591839b5c48e	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:42:36.702	2026-08-09 11:42:36.702	2026-08-09 11:42:36.702
28688182-598b-41ad-9bf6-29dc802b0704	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:42:47.493	2026-08-09 11:42:47.493	2026-08-09 11:42:47.493
cbec9ea7-daf6-4898-8119-57372dad053e	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:43:12.795	2026-08-09 11:43:12.795	2026-08-09 11:43:12.795
da6e7da4-0159-4c6f-9a9e-6ac1a9adf88d	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:43:41.792	2026-08-09 11:43:41.792	2026-08-09 11:43:41.792
b67ba708-ac8e-4df9-846c-d794da36ab92	1733c375-44dd-419e-bdaf-7f3a95e6f801	650.00	PENDING	2026-08-09 11:46:10.253	2026-08-09 11:46:10.253	2026-08-09 11:46:10.253
1e8cb8f7-c6b0-46c0-bcf5-c17b98a1f43e	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PENDING	2026-08-09 11:53:31.935	2026-08-09 11:53:31.935	2026-08-09 11:53:31.935
e72091a8-0e3f-4750-8d25-14d1c1f779fa	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PENDING	2026-08-09 11:54:25.39	2026-08-09 11:54:25.39	2026-08-09 11:54:25.39
b01d7f38-3b9f-4c51-96b3-e3bdb25d19be	1733c375-44dd-419e-bdaf-7f3a95e6f801	899.00	PENDING	2026-08-09 11:56:34.731	2026-08-09 11:56:34.731	2026-08-09 11:56:34.731
a994c575-5474-4b60-81d5-a0f088924e5f	1733c375-44dd-419e-bdaf-7f3a95e6f801	2499.00	PENDING	2026-08-09 11:56:42.493	2026-08-09 11:56:42.493	2026-08-09 11:56:42.493
e1d2e199-442b-47ca-8432-2fe597d0ce76	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PENDING	2026-08-09 12:14:30.492	2026-08-09 12:14:30.492	2026-08-09 12:14:30.492
9a123f9f-5546-4449-982e-a18104b2e95d	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PROCESSING	2026-08-09 12:14:59.906	2026-08-09 12:14:59.906	2026-08-09 12:15:22.818
ed5a7316-a543-4656-8e82-9d5ed2ec95df	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PENDING	2026-08-10 02:29:07.662	2026-08-10 02:29:07.662	2026-08-10 02:29:07.662
4c995752-7388-4887-ad28-f7870393ba1d	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	PENDING	2026-08-10 02:29:57.452	2026-08-10 02:29:57.452	2026-08-10 02:29:57.452
15e23b29-87a2-447f-b8e7-9848703abdde	1733c375-44dd-419e-bdaf-7f3a95e6f801	299.00	DELIVERED	2026-08-10 02:30:57.638	2026-08-10 02:30:57.638	2026-08-10 02:32:04.336
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, payment_method, payment_status, transaction_id) FROM stdin;
f0eb7c33-9442-4f62-a009-ebf8da48f10d	b1dca789-cecf-47ef-ae0e-b6abe277ed54	ESEWA	COMPLETED	TXN-1786189481119
52a7a945-ff34-46b2-8524-1710eee807f6	e68d81c0-d1ce-45d6-a1b9-65077823762f	CASH_ON_DELIVERY	COMPLETED	TXN-1786190384990
9888235c-ee86-435b-8e67-d8d4db5db53f	36790da1-d126-438d-9f8d-c294072f3e28	KHALTI	COMPLETED	1234
8bd81386-57e4-4aaa-94a4-ad33798c4494	12269f7e-2abf-41c4-bdd5-54fdc7877264	CARD	COMPLETED	2432
954d352d-535f-41a0-a78b-459632d0dd0a	20b7e6a1-ec80-4e6d-8005-d87d0bf47a3f	CASH_ON_DELIVERY	COMPLETED	TXN-1786275489776
2e85fcf0-267c-4fe2-888e-1104630b4e04	2fcccce1-e754-4367-9b4c-591839b5c48e	KHALTI	COMPLETED	TXN-1786275756700
721b6e78-874e-4626-91b9-14bdfceb185a	28688182-598b-41ad-9bf6-29dc802b0704	KHALTI	COMPLETED	TXN-1786275767490
fdd4ed23-5e14-4812-b11d-8011690e6290	cbec9ea7-daf6-4898-8119-57372dad053e	ESEWA	COMPLETED	TXN-1786275792792
08ad0d22-2a50-485d-b423-ec960db4684d	da6e7da4-0159-4c6f-9a9e-6ac1a9adf88d	ESEWA	COMPLETED	TXN-1786275821789
4882d7ca-6b4e-4c99-a0f3-5518ced17957	b67ba708-ac8e-4df9-846c-d794da36ab92	ESEWA	COMPLETED	TXN-1786275970249
c04e6102-f73a-458f-bcfc-ff1e2f637a5d	1e8cb8f7-c6b0-46c0-bcf5-c17b98a1f43e	ESEWA	PENDING	PENDING-1786276411932
c6871538-d79a-4c60-ae6c-ef1871bd65c5	e72091a8-0e3f-4750-8d25-14d1c1f779fa	ESEWA	COMPLETED	4897
d51548d3-a2fa-4a53-824c-05e57c9853de	b01d7f38-3b9f-4c51-96b3-e3bdb25d19be	KHALTI	COMPLETED	6789
8c972b2a-6b82-40cd-a58c-9e601303f82f	a994c575-5474-4b60-81d5-a0f088924e5f	KHALTI	PENDING	PENDING-1786276602491
db871242-cdf4-460f-ac85-5872e9f7d465	e1d2e199-442b-47ca-8432-2fe597d0ce76	ESEWA	PENDING	PENDING-1786277670488
e80a7c3d-48b2-476e-8d0d-6008ff64e012	9a123f9f-5546-4449-982e-a18104b2e95d	ESEWA	COMPLETED	12ae
337ed0b3-2496-4bc1-bfae-c61e25fc3df3	ed5a7316-a543-4656-8e82-9d5ed2ec95df	CASH_ON_DELIVERY	PENDING	PENDING-1786328947658
1233a5fa-f354-44f1-a7b0-83606f462fd7	4c995752-7388-4887-ad28-f7870393ba1d	ESEWA	PENDING	PENDING-1786328997449
ad082ace-e997-48f3-b009-565e9cc10e4b	15e23b29-87a2-447f-b8e7-9848703abdde	ESEWA	COMPLETED	5687
\.


--
-- Data for Name: product_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_images (id, product_id, image_url) FROM stdin;
1be8a610-54a6-413c-8767-b9ad297e0bd1	7779a37c-32ad-4cbc-9060-546160ed3371	http://localhost:5000/uploads/product_1786189416626.jpg
2ae059f5-49de-4d7b-98c0-45cb32efe1cd	826fbbbc-25ad-4c95-8f14-a56fe1ebb0e3	https://imgs.search.brave.com/yfh0gNU2syQaSd-dw8rQTwCb935NhSLpY_d_BMbqwY8/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9wcmV2/aWV3LnJlZGQuaXQv/bW9uc3RlcmEtZGVs/aWNpb3NhLWZhbWls/eS1waWN0dXJlLXYw/LXFzcXFhMWg1aTMy/YzEuanBnP3dpZHRo/PTY0MCZjcm9wPXNt/YXJ0JmF1dG89d2Vi/cCZzPWRlODIzMmNk/Y2Y2MDk4N2I5OWVl/ZWZmNDk1MmMzYTAw/NmEzN2JiMmU
7d93f466-4c63-49e4-98b6-c3c5fd176b7d	049c4212-3d52-47a0-82db-d383c288d636	http://localhost:5000/uploads/product_1786276316537.jpeg
fce4ce1a-c4d8-444f-8b46-a415df51bcde	40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	https://imgs.search.brave.com/-IdhommBVa8r9Ef8eYKAAC8fFmJlkvd-eMOkCdUQJmI/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9pbWcu/bWFnbmlmaWMuY29t/L3ByZW1pdW0tcGhv/dG8vY2xvc2UtdXAt/YmVhdXRpZnVsLW1p/bnQtcGxhbnRzLXNh/bGUtZ2FyZGVuLWNl/bnRlcl8yNjk2NTUt/MzEyMTcuanBnP3Nl/bXQ9YWlzX3Rlc3Rf/YiZ3PTc0MCZxPTgw
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, vendor_id, category_id, name, description, price, stock, created_at, updated_at) FROM stdin;
7779a37c-32ad-4cbc-9060-546160ed3371	7aa6f91b-1cac-4f72-8f06-be51b247bfad	31421913-b88b-4686-8dfd-dd410a06d955	Aloe Vera	A hardy succulent with thick, fleshy leaves known for its low-maintenance care. Ideal for sunny windowsills, balconies, and indoor spaces.	650.00	31	2026-08-08 11:43:36.629	2026-08-09 11:46:10.274
049c4212-3d52-47a0-82db-d383c288d636	7aa6f91b-1cac-4f72-8f06-be51b247bfad	c867c210-b269-4a35-bc12-d1891da065cc	Snake Plant	A hardy and low-maintenance indoor plant with tall, upright green leaves. It grows well in low-light conditions and is an excellent choice for beginners.	899.00	39	2026-08-09 11:51:56.546	2026-08-09 11:56:34.747
826fbbbc-25ad-4c95-8f14-a56fe1ebb0e3	7aa6f91b-1cac-4f72-8f06-be51b247bfad	235bde91-7a54-4350-8e9f-7fa4d1ca0943	Monstera Deliciosa	A beautiful tropical indoor plant with large, naturally split green leaves. Easy to care for and perfect for homes, offices, and balconies.	2499.00	24	2026-08-09 11:50:27.126	2026-08-09 11:56:42.522
40b1bc34-c75a-4c25-a13a-bd2a8e2fab8b	7aa6f91b-1cac-4f72-8f06-be51b247bfad	ff520373-a7e9-4397-983a-50e374df84c1	Mint Plant	A fragrant and fast-growing herb that is perfect for tea, cooking, and refreshing drinks. Grow it in your kitchen, balcony, or home garden for a continuous supply of fresh mint.	299.00	28	2026-08-09 11:52:43.119	2026-08-10 02:30:57.653
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reviews (id, user_id, product_id, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password, role, phone, created_at, updated_at) FROM stdin;
af2d2550-fec1-4bd5-b810-9f6c98135817	Platform Administrator	admin@plantmarket.com	$2b$10$.MX8KyzG9WCuPNBqbcJ/F.fySrhPRsao5KrVv8ZFLkgWhqtqzZJL6	ADMIN	+9779800000000	2026-08-01 05:23:40.576	2026-08-01 05:23:40.576
7a34751c-c906-4c60-a3b4-42cd60cb8a2f	Evergreen Nursery Owner	evergreen@nursery.com	$2b$10$gN59XlVRdiNtT88TSd4BdeS8yMpFrhNUVVbcOg78YtxGysNgZvPOO	VENDOR	+9779811111111	2026-08-01 05:23:40.58	2026-08-01 05:23:40.58
1733c375-44dd-419e-bdaf-7f3a95e6f801	John Doe	john@customer.com	$2b$10$YtOJGGa0ZRsjZdnJ7lOAbu8UPDoMZOKsN18XCsVlPAGJ0xwF.KerC	CUSTOMER	+9779822222222	2026-08-01 05:23:40.587	2026-08-01 05:23:40.587
\.


--
-- Data for Name: vendors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vendors (id, user_id, store_name, description, verification_status, created_at, updated_at) FROM stdin;
7aa6f91b-1cac-4f72-8f06-be51b247bfad	7a34751c-c906-4c60-a3b4-42cd60cb8a2f	Evergreen Nursery	Your premium source for healthy indoor and outdoor plants.	APPROVED	2026-08-01 05:23:40.583	2026-08-08 11:42:30.666
\.


--
-- Data for Name: wishlists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wishlists (id, user_id, product_id) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: wishlists wishlists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_pkey PRIMARY KEY (id);


--
-- Name: carts_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX carts_user_id_key ON public.carts USING btree (user_id);


--
-- Name: categories_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX categories_name_key ON public.categories USING btree (name);


--
-- Name: payments_order_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX payments_order_id_key ON public.payments USING btree (order_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: vendors_user_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX vendors_user_id_key ON public.vendors USING btree (user_id);


--
-- Name: wishlists_user_id_product_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX wishlists_user_id_product_id_key ON public.wishlists USING btree (user_id, product_id);


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: products products_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: vendors vendors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wishlists wishlists_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: wishlists wishlists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlists
    ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ImN6tbjlrX9OP1BhBHeooy8WdxRk4t6MsbbSWOvJNb2RRphOwbmPjRInwqIzZk5

