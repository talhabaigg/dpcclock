PGDMP                      }            base    16.3 (Homebrew)    16.3 �    F           0    0    ENCODING    ENCODING        SET client_encoding = 'UTF8';
                      false            G           0    0 
   STDSTRINGS 
   STDSTRINGS     (   SET standard_conforming_strings = 'on';
                      false            H           0    0 
   SEARCHPATH 
   SEARCHPATH     8   SELECT pg_catalog.set_config('search_path', '', false);
                      false            I           1262    16384    base    DATABASE     f   CREATE DATABASE base WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'C';
    DROP DATABASE base;
                tripteki    false                        2615    257103    public    SCHEMA        CREATE SCHEMA public;
    DROP SCHEMA public;
                tripteki    false            J           0    0    SCHEMA public    ACL     +   REVOKE USAGE ON SCHEMA public FROM PUBLIC;
                   tripteki    false    6            �            1259    423485    cache    TABLE     �   CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);
    DROP TABLE public.cache;
       public         heap    tripteki    false    6            �            1259    423492    cache_locks    TABLE     �   CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);
    DROP TABLE public.cache_locks;
       public         heap    tripteki    false    6            �            1259    423575    clocks    TABLE     4  CREATE TABLE public.clocks (
    id bigint NOT NULL,
    eh_kiosk_id bigint NOT NULL,
    eh_employee_id character varying NOT NULL,
    clock_in timestamp(0) without time zone,
    clock_out timestamp(0) without time zone,
    eh_location_id character varying(255),
    hours_worked numeric(8,2),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    status character varying(255),
    laser_allowance boolean DEFAULT false,
    insulation_allowance boolean DEFAULT false,
    setout_allowance boolean DEFAULT false
);
    DROP TABLE public.clocks;
       public         heap    tripteki    false    6            �            1259    423574    clocks_id_seq    SEQUENCE     v   CREATE SEQUENCE public.clocks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 $   DROP SEQUENCE public.clocks_id_seq;
       public          tripteki    false    6    238            K           0    0    clocks_id_seq    SEQUENCE OWNED BY     ?   ALTER SEQUENCE public.clocks_id_seq OWNED BY public.clocks.id;
          public          tripteki    false    237            �            1259    423566    employee_kiosk    TABLE     �   CREATE TABLE public.employee_kiosk (
    id bigint NOT NULL,
    eh_kiosk_id character varying(255),
    eh_employee_id character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
 "   DROP TABLE public.employee_kiosk;
       public         heap    tripteki    false    6            �            1259    423565    employee_kiosk_id_seq    SEQUENCE     ~   CREATE SEQUENCE public.employee_kiosk_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 ,   DROP SEQUENCE public.employee_kiosk_id_seq;
       public          tripteki    false    236    6            L           0    0    employee_kiosk_id_seq    SEQUENCE OWNED BY     O   ALTER SEQUENCE public.employee_kiosk_id_seq OWNED BY public.employee_kiosk.id;
          public          tripteki    false    235            �            1259    423610    employee_worktype    TABLE     �   CREATE TABLE public.employee_worktype (
    id bigint NOT NULL,
    employee_id bigint NOT NULL,
    worktype_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
 %   DROP TABLE public.employee_worktype;
       public         heap    tripteki    false    6            �            1259    423609    employee_worktype_id_seq    SEQUENCE     �   CREATE SEQUENCE public.employee_worktype_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 /   DROP SEQUENCE public.employee_worktype_id_seq;
       public          tripteki    false    6    244            M           0    0    employee_worktype_id_seq    SEQUENCE OWNED BY     U   ALTER SEQUENCE public.employee_worktype_id_seq OWNED BY public.employee_worktype.id;
          public          tripteki    false    243            �            1259    423529 	   employees    TABLE     {  CREATE TABLE public.employees (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    eh_employee_id character varying(255) NOT NULL,
    external_id character varying(255) NOT NULL,
    pin character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.employees;
       public         heap    tripteki    false    6            �            1259    423528    employees_id_seq    SEQUENCE     y   CREATE SEQUENCE public.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 '   DROP SEQUENCE public.employees_id_seq;
       public          tripteki    false    230    6            N           0    0    employees_id_seq    SEQUENCE OWNED BY     E   ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;
          public          tripteki    false    229            �            1259    423517    failed_jobs    TABLE     &  CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
    DROP TABLE public.failed_jobs;
       public         heap    tripteki    false    6            �            1259    423516    failed_jobs_id_seq    SEQUENCE     {   CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.failed_jobs_id_seq;
       public          tripteki    false    6    228            O           0    0    failed_jobs_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;
          public          tripteki    false    227            �            1259    423509    job_batches    TABLE     d  CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);
    DROP TABLE public.job_batches;
       public         heap    tripteki    false    6            �            1259    423500    jobs    TABLE     �   CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);
    DROP TABLE public.jobs;
       public         heap    tripteki    false    6            �            1259    423499    jobs_id_seq    SEQUENCE     t   CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 "   DROP SEQUENCE public.jobs_id_seq;
       public          tripteki    false    225    6            P           0    0    jobs_id_seq    SEQUENCE OWNED BY     ;   ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;
          public          tripteki    false    224            �            1259    423555    kiosks    TABLE     �  CREATE TABLE public.kiosks (
    id bigint NOT NULL,
    eh_kiosk_id character varying(255) NOT NULL,
    eh_location_id character varying(255),
    name character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    default_start_time time(0) without time zone DEFAULT '06:30:00'::time without time zone,
    default_end_time time(0) without time zone DEFAULT '14:30:00'::time without time zone
);
    DROP TABLE public.kiosks;
       public         heap    tripteki    false    6            �            1259    423554    kiosks_id_seq    SEQUENCE     v   CREATE SEQUENCE public.kiosks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 $   DROP SEQUENCE public.kiosks_id_seq;
       public          tripteki    false    234    6            Q           0    0    kiosks_id_seq    SEQUENCE OWNED BY     ?   ALTER SEQUENCE public.kiosks_id_seq OWNED BY public.kiosks.id;
          public          tripteki    false    233            �            1259    423593    location_worktype    TABLE     �   CREATE TABLE public.location_worktype (
    id bigint NOT NULL,
    location_id bigint NOT NULL,
    worktype_id bigint NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
 %   DROP TABLE public.location_worktype;
       public         heap    tripteki    false    6            �            1259    423592    location_worktype_id_seq    SEQUENCE     �   CREATE SEQUENCE public.location_worktype_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 /   DROP SEQUENCE public.location_worktype_id_seq;
       public          tripteki    false    6    242            R           0    0    location_worktype_id_seq    SEQUENCE OWNED BY     U   ALTER SEQUENCE public.location_worktype_id_seq OWNED BY public.location_worktype.id;
          public          tripteki    false    241            �            1259    423544 	   locations    TABLE     G  CREATE TABLE public.locations (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    eh_location_id character varying(255) NOT NULL,
    eh_parent_id character varying(255),
    external_id character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.locations;
       public         heap    tripteki    false    6            �            1259    423543    locations_id_seq    SEQUENCE     y   CREATE SEQUENCE public.locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 '   DROP SEQUENCE public.locations_id_seq;
       public          tripteki    false    6    232            S           0    0    locations_id_seq    SEQUENCE OWNED BY     E   ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;
          public          tripteki    false    231            �            1259    423452 
   migrations    TABLE     �   CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);
    DROP TABLE public.migrations;
       public         heap    tripteki    false    6            �            1259    423451    migrations_id_seq    SEQUENCE     �   CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 (   DROP SEQUENCE public.migrations_id_seq;
       public          tripteki    false    217    6            T           0    0    migrations_id_seq    SEQUENCE OWNED BY     G   ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;
          public          tripteki    false    216            �            1259    423648    model_has_permissions    TABLE     �   CREATE TABLE public.model_has_permissions (
    permission_id bigint NOT NULL,
    model_type character varying(255) NOT NULL,
    model_id bigint NOT NULL
);
 )   DROP TABLE public.model_has_permissions;
       public         heap    tripteki    false    6            �            1259    423659    model_has_roles    TABLE     �   CREATE TABLE public.model_has_roles (
    role_id bigint NOT NULL,
    model_type character varying(255) NOT NULL,
    model_id bigint NOT NULL
);
 #   DROP TABLE public.model_has_roles;
       public         heap    tripteki    false    6            �            1259    423469    password_reset_tokens    TABLE     �   CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);
 )   DROP TABLE public.password_reset_tokens;
       public         heap    tripteki    false    6            �            1259    423627    permissions    TABLE     �   CREATE TABLE public.permissions (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    guard_name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.permissions;
       public         heap    tripteki    false    6            �            1259    423626    permissions_id_seq    SEQUENCE     {   CREATE SEQUENCE public.permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 )   DROP SEQUENCE public.permissions_id_seq;
       public          tripteki    false    6    246            U           0    0    permissions_id_seq    SEQUENCE OWNED BY     I   ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;
          public          tripteki    false    245            �            1259    423691    personal_access_tokens    TABLE     �  CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
 *   DROP TABLE public.personal_access_tokens;
       public         heap    tripteki    false    6            �            1259    423690    personal_access_tokens_id_seq    SEQUENCE     �   CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 4   DROP SEQUENCE public.personal_access_tokens_id_seq;
       public          tripteki    false    6    253            V           0    0    personal_access_tokens_id_seq    SEQUENCE OWNED BY     _   ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;
          public          tripteki    false    252            �            1259    423670    role_has_permissions    TABLE     m   CREATE TABLE public.role_has_permissions (
    permission_id bigint NOT NULL,
    role_id bigint NOT NULL
);
 (   DROP TABLE public.role_has_permissions;
       public         heap    tripteki    false    6            �            1259    423638    roles    TABLE     �   CREATE TABLE public.roles (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    guard_name character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.roles;
       public         heap    tripteki    false    6            �            1259    423637    roles_id_seq    SEQUENCE     u   CREATE SEQUENCE public.roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 #   DROP SEQUENCE public.roles_id_seq;
       public          tripteki    false    6    248            W           0    0    roles_id_seq    SEQUENCE OWNED BY     =   ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;
          public          tripteki    false    247            �            1259    423476    sessions    TABLE     �   CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);
    DROP TABLE public.sessions;
       public         heap    tripteki    false    6            �            1259    423459    users    TABLE     x  CREATE TABLE public.users (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified_at timestamp(0) without time zone,
    password character varying(255) NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.users;
       public         heap    tripteki    false    6            �            1259    423458    users_id_seq    SEQUENCE     u   CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 #   DROP SEQUENCE public.users_id_seq;
       public          tripteki    false    6    219            X           0    0    users_id_seq    SEQUENCE OWNED BY     =   ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
          public          tripteki    false    218            �            1259    423584 	   worktypes    TABLE     J  CREATE TABLE public.worktypes (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    eh_worktype_id character varying(255) NOT NULL,
    eh_external_id character varying(255),
    mapping_type character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
    DROP TABLE public.worktypes;
       public         heap    tripteki    false    6            �            1259    423583    worktypes_id_seq    SEQUENCE     y   CREATE SEQUENCE public.worktypes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
 '   DROP SEQUENCE public.worktypes_id_seq;
       public          tripteki    false    6    240            Y           0    0    worktypes_id_seq    SEQUENCE OWNED BY     E   ALTER SEQUENCE public.worktypes_id_seq OWNED BY public.worktypes.id;
          public          tripteki    false    239            3           2604    423578 	   clocks id    DEFAULT     f   ALTER TABLE ONLY public.clocks ALTER COLUMN id SET DEFAULT nextval('public.clocks_id_seq'::regclass);
 8   ALTER TABLE public.clocks ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    237    238    238            2           2604    423569    employee_kiosk id    DEFAULT     v   ALTER TABLE ONLY public.employee_kiosk ALTER COLUMN id SET DEFAULT nextval('public.employee_kiosk_id_seq'::regclass);
 @   ALTER TABLE public.employee_kiosk ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    235    236    236            9           2604    423613    employee_worktype id    DEFAULT     |   ALTER TABLE ONLY public.employee_worktype ALTER COLUMN id SET DEFAULT nextval('public.employee_worktype_id_seq'::regclass);
 C   ALTER TABLE public.employee_worktype ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    244    243    244            -           2604    423532    employees id    DEFAULT     l   ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);
 ;   ALTER TABLE public.employees ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    230    229    230            +           2604    423520    failed_jobs id    DEFAULT     p   ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);
 =   ALTER TABLE public.failed_jobs ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    227    228    228            *           2604    423503    jobs id    DEFAULT     b   ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);
 6   ALTER TABLE public.jobs ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    225    224    225            /           2604    423558 	   kiosks id    DEFAULT     f   ALTER TABLE ONLY public.kiosks ALTER COLUMN id SET DEFAULT nextval('public.kiosks_id_seq'::regclass);
 8   ALTER TABLE public.kiosks ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    233    234    234            8           2604    423596    location_worktype id    DEFAULT     |   ALTER TABLE ONLY public.location_worktype ALTER COLUMN id SET DEFAULT nextval('public.location_worktype_id_seq'::regclass);
 C   ALTER TABLE public.location_worktype ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    242    241    242            .           2604    423547    locations id    DEFAULT     l   ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);
 ;   ALTER TABLE public.locations ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    231    232    232            (           2604    423455    migrations id    DEFAULT     n   ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
 <   ALTER TABLE public.migrations ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    216    217    217            :           2604    423630    permissions id    DEFAULT     p   ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);
 =   ALTER TABLE public.permissions ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    246    245    246            <           2604    423694    personal_access_tokens id    DEFAULT     �   ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);
 H   ALTER TABLE public.personal_access_tokens ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    253    252    253            ;           2604    423641    roles id    DEFAULT     d   ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);
 7   ALTER TABLE public.roles ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    248    247    248            )           2604    423462    users id    DEFAULT     d   ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
 7   ALTER TABLE public.users ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    219    218    219            7           2604    423587    worktypes id    DEFAULT     l   ALTER TABLE ONLY public.worktypes ALTER COLUMN id SET DEFAULT nextval('public.worktypes_id_seq'::regclass);
 ;   ALTER TABLE public.worktypes ALTER COLUMN id DROP DEFAULT;
       public          tripteki    false    239    240    240            $          0    423485    cache 
   TABLE DATA           7   COPY public.cache (key, value, expiration) FROM stdin;
    public          tripteki    false    222   w�       %          0    423492    cache_locks 
   TABLE DATA           =   COPY public.cache_locks (key, owner, expiration) FROM stdin;
    public          tripteki    false    223   �       4          0    423575    clocks 
   TABLE DATA           �   COPY public.clocks (id, eh_kiosk_id, eh_employee_id, clock_in, clock_out, eh_location_id, hours_worked, created_at, updated_at, status, laser_allowance, insulation_allowance, setout_allowance) FROM stdin;
    public          tripteki    false    238   6�       2          0    423566    employee_kiosk 
   TABLE DATA           a   COPY public.employee_kiosk (id, eh_kiosk_id, eh_employee_id, created_at, updated_at) FROM stdin;
    public          tripteki    false    236   ��       :          0    423610    employee_worktype 
   TABLE DATA           a   COPY public.employee_worktype (id, employee_id, worktype_id, created_at, updated_at) FROM stdin;
    public          tripteki    false    244   ��       ,          0    423529 	   employees 
   TABLE DATA           n   COPY public.employees (id, name, email, eh_employee_id, external_id, pin, created_at, updated_at) FROM stdin;
    public          tripteki    false    230   �       *          0    423517    failed_jobs 
   TABLE DATA           a   COPY public.failed_jobs (id, uuid, connection, queue, payload, exception, failed_at) FROM stdin;
    public          tripteki    false    228   f�       (          0    423509    job_batches 
   TABLE DATA           �   COPY public.job_batches (id, name, total_jobs, pending_jobs, failed_jobs, failed_job_ids, options, cancelled_at, created_at, finished_at) FROM stdin;
    public          tripteki    false    226   ��       '          0    423500    jobs 
   TABLE DATA           c   COPY public.jobs (id, queue, payload, attempts, reserved_at, available_at, created_at) FROM stdin;
    public          tripteki    false    225   ��       0          0    423555    kiosks 
   TABLE DATA           �   COPY public.kiosks (id, eh_kiosk_id, eh_location_id, name, created_at, updated_at, default_start_time, default_end_time) FROM stdin;
    public          tripteki    false    234   ��       8          0    423593    location_worktype 
   TABLE DATA           a   COPY public.location_worktype (id, location_id, worktype_id, created_at, updated_at) FROM stdin;
    public          tripteki    false    242   �       .          0    423544 	   locations 
   TABLE DATA           p   COPY public.locations (id, name, eh_location_id, eh_parent_id, external_id, created_at, updated_at) FROM stdin;
    public          tripteki    false    232   )�                 0    423452 
   migrations 
   TABLE DATA           :   COPY public.migrations (id, migration, batch) FROM stdin;
    public          tripteki    false    217   j�       ?          0    423648    model_has_permissions 
   TABLE DATA           T   COPY public.model_has_permissions (permission_id, model_type, model_id) FROM stdin;
    public          tripteki    false    249   ��       @          0    423659    model_has_roles 
   TABLE DATA           H   COPY public.model_has_roles (role_id, model_type, model_id) FROM stdin;
    public          tripteki    false    250   ��       "          0    423469    password_reset_tokens 
   TABLE DATA           I   COPY public.password_reset_tokens (email, token, created_at) FROM stdin;
    public          tripteki    false    220   ��       <          0    423627    permissions 
   TABLE DATA           S   COPY public.permissions (id, name, guard_name, created_at, updated_at) FROM stdin;
    public          tripteki    false    246   �       C          0    423691    personal_access_tokens 
   TABLE DATA           �   COPY public.personal_access_tokens (id, tokenable_type, tokenable_id, name, token, abilities, last_used_at, expires_at, created_at, updated_at) FROM stdin;
    public          tripteki    false    253   r�       A          0    423670    role_has_permissions 
   TABLE DATA           F   COPY public.role_has_permissions (permission_id, role_id) FROM stdin;
    public          tripteki    false    251   ��       >          0    423638    roles 
   TABLE DATA           M   COPY public.roles (id, name, guard_name, created_at, updated_at) FROM stdin;
    public          tripteki    false    248   ��       #          0    423476    sessions 
   TABLE DATA           _   COPY public.sessions (id, user_id, ip_address, user_agent, payload, last_activity) FROM stdin;
    public          tripteki    false    221   �       !          0    423459    users 
   TABLE DATA           u   COPY public.users (id, name, email, email_verified_at, password, remember_token, created_at, updated_at) FROM stdin;
    public          tripteki    false    219   �       6          0    423584 	   worktypes 
   TABLE DATA           s   COPY public.worktypes (id, name, eh_worktype_id, eh_external_id, mapping_type, created_at, updated_at) FROM stdin;
    public          tripteki    false    240   ��       Z           0    0    clocks_id_seq    SEQUENCE SET     <   SELECT pg_catalog.setval('public.clocks_id_seq', 27, true);
          public          tripteki    false    237            [           0    0    employee_kiosk_id_seq    SEQUENCE SET     D   SELECT pg_catalog.setval('public.employee_kiosk_id_seq', 1, false);
          public          tripteki    false    235            \           0    0    employee_worktype_id_seq    SEQUENCE SET     G   SELECT pg_catalog.setval('public.employee_worktype_id_seq', 1, false);
          public          tripteki    false    243            ]           0    0    employees_id_seq    SEQUENCE SET     ?   SELECT pg_catalog.setval('public.employees_id_seq', 10, true);
          public          tripteki    false    229            ^           0    0    failed_jobs_id_seq    SEQUENCE SET     A   SELECT pg_catalog.setval('public.failed_jobs_id_seq', 1, false);
          public          tripteki    false    227            _           0    0    jobs_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.jobs_id_seq', 1, false);
          public          tripteki    false    224            `           0    0    kiosks_id_seq    SEQUENCE SET     ;   SELECT pg_catalog.setval('public.kiosks_id_seq', 1, true);
          public          tripteki    false    233            a           0    0    location_worktype_id_seq    SEQUENCE SET     G   SELECT pg_catalog.setval('public.location_worktype_id_seq', 1, false);
          public          tripteki    false    241            b           0    0    locations_id_seq    SEQUENCE SET     ?   SELECT pg_catalog.setval('public.locations_id_seq', 1, false);
          public          tripteki    false    231            c           0    0    migrations_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.migrations_id_seq', 16, true);
          public          tripteki    false    216            d           0    0    permissions_id_seq    SEQUENCE SET     @   SELECT pg_catalog.setval('public.permissions_id_seq', 2, true);
          public          tripteki    false    245            e           0    0    personal_access_tokens_id_seq    SEQUENCE SET     L   SELECT pg_catalog.setval('public.personal_access_tokens_id_seq', 1, false);
          public          tripteki    false    252            f           0    0    roles_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.roles_id_seq', 2, true);
          public          tripteki    false    247            g           0    0    users_id_seq    SEQUENCE SET     :   SELECT pg_catalog.setval('public.users_id_seq', 2, true);
          public          tripteki    false    218            h           0    0    worktypes_id_seq    SEQUENCE SET     ?   SELECT pg_catalog.setval('public.worktypes_id_seq', 1, false);
          public          tripteki    false    239            L           2606    423498    cache_locks cache_locks_pkey 
   CONSTRAINT     [   ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);
 F   ALTER TABLE ONLY public.cache_locks DROP CONSTRAINT cache_locks_pkey;
       public            tripteki    false    223            J           2606    423491    cache cache_pkey 
   CONSTRAINT     O   ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);
 :   ALTER TABLE ONLY public.cache DROP CONSTRAINT cache_pkey;
       public            tripteki    false    222            k           2606    423580    clocks clocks_pkey 
   CONSTRAINT     P   ALTER TABLE ONLY public.clocks
    ADD CONSTRAINT clocks_pkey PRIMARY KEY (id);
 <   ALTER TABLE ONLY public.clocks DROP CONSTRAINT clocks_pkey;
       public            tripteki    false    238            g           2606    423573 "   employee_kiosk employee_kiosk_pkey 
   CONSTRAINT     `   ALTER TABLE ONLY public.employee_kiosk
    ADD CONSTRAINT employee_kiosk_pkey PRIMARY KEY (id);
 L   ALTER TABLE ONLY public.employee_kiosk DROP CONSTRAINT employee_kiosk_pkey;
       public            tripteki    false    236            q           2606    423615 (   employee_worktype employee_worktype_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.employee_worktype
    ADD CONSTRAINT employee_worktype_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.employee_worktype DROP CONSTRAINT employee_worktype_pkey;
       public            tripteki    false    244            W           2606    423540 )   employees employees_eh_employee_id_unique 
   CONSTRAINT     n   ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_eh_employee_id_unique UNIQUE (eh_employee_id);
 S   ALTER TABLE ONLY public.employees DROP CONSTRAINT employees_eh_employee_id_unique;
       public            tripteki    false    230            Y           2606    423538     employees employees_email_unique 
   CONSTRAINT     \   ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_unique UNIQUE (email);
 J   ALTER TABLE ONLY public.employees DROP CONSTRAINT employees_email_unique;
       public            tripteki    false    230            [           2606    423542 &   employees employees_external_id_unique 
   CONSTRAINT     h   ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_external_id_unique UNIQUE (external_id);
 P   ALTER TABLE ONLY public.employees DROP CONSTRAINT employees_external_id_unique;
       public            tripteki    false    230            ]           2606    423536    employees employees_pkey 
   CONSTRAINT     V   ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);
 B   ALTER TABLE ONLY public.employees DROP CONSTRAINT employees_pkey;
       public            tripteki    false    230            S           2606    423525    failed_jobs failed_jobs_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.failed_jobs DROP CONSTRAINT failed_jobs_pkey;
       public            tripteki    false    228            U           2606    423527 #   failed_jobs failed_jobs_uuid_unique 
   CONSTRAINT     ^   ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);
 M   ALTER TABLE ONLY public.failed_jobs DROP CONSTRAINT failed_jobs_uuid_unique;
       public            tripteki    false    228            Q           2606    423515    job_batches job_batches_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.job_batches DROP CONSTRAINT job_batches_pkey;
       public            tripteki    false    226            N           2606    423507    jobs jobs_pkey 
   CONSTRAINT     L   ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);
 8   ALTER TABLE ONLY public.jobs DROP CONSTRAINT jobs_pkey;
       public            tripteki    false    225            c           2606    423564     kiosks kiosks_eh_kiosk_id_unique 
   CONSTRAINT     b   ALTER TABLE ONLY public.kiosks
    ADD CONSTRAINT kiosks_eh_kiosk_id_unique UNIQUE (eh_kiosk_id);
 J   ALTER TABLE ONLY public.kiosks DROP CONSTRAINT kiosks_eh_kiosk_id_unique;
       public            tripteki    false    234            e           2606    423562    kiosks kiosks_pkey 
   CONSTRAINT     P   ALTER TABLE ONLY public.kiosks
    ADD CONSTRAINT kiosks_pkey PRIMARY KEY (id);
 <   ALTER TABLE ONLY public.kiosks DROP CONSTRAINT kiosks_pkey;
       public            tripteki    false    234            o           2606    423598 (   location_worktype location_worktype_pkey 
   CONSTRAINT     f   ALTER TABLE ONLY public.location_worktype
    ADD CONSTRAINT location_worktype_pkey PRIMARY KEY (id);
 R   ALTER TABLE ONLY public.location_worktype DROP CONSTRAINT location_worktype_pkey;
       public            tripteki    false    242            _           2606    423553 )   locations locations_eh_location_id_unique 
   CONSTRAINT     n   ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_eh_location_id_unique UNIQUE (eh_location_id);
 S   ALTER TABLE ONLY public.locations DROP CONSTRAINT locations_eh_location_id_unique;
       public            tripteki    false    232            a           2606    423551    locations locations_pkey 
   CONSTRAINT     V   ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
 B   ALTER TABLE ONLY public.locations DROP CONSTRAINT locations_pkey;
       public            tripteki    false    232            >           2606    423457    migrations migrations_pkey 
   CONSTRAINT     X   ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);
 D   ALTER TABLE ONLY public.migrations DROP CONSTRAINT migrations_pkey;
       public            tripteki    false    217            |           2606    423658 0   model_has_permissions model_has_permissions_pkey 
   CONSTRAINT     �   ALTER TABLE ONLY public.model_has_permissions
    ADD CONSTRAINT model_has_permissions_pkey PRIMARY KEY (permission_id, model_id, model_type);
 Z   ALTER TABLE ONLY public.model_has_permissions DROP CONSTRAINT model_has_permissions_pkey;
       public            tripteki    false    249    249    249                       2606    423669 $   model_has_roles model_has_roles_pkey 
   CONSTRAINT     }   ALTER TABLE ONLY public.model_has_roles
    ADD CONSTRAINT model_has_roles_pkey PRIMARY KEY (role_id, model_id, model_type);
 N   ALTER TABLE ONLY public.model_has_roles DROP CONSTRAINT model_has_roles_pkey;
       public            tripteki    false    250    250    250            D           2606    423475 0   password_reset_tokens password_reset_tokens_pkey 
   CONSTRAINT     q   ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);
 Z   ALTER TABLE ONLY public.password_reset_tokens DROP CONSTRAINT password_reset_tokens_pkey;
       public            tripteki    false    220            s           2606    423636 .   permissions permissions_name_guard_name_unique 
   CONSTRAINT     u   ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_guard_name_unique UNIQUE (name, guard_name);
 X   ALTER TABLE ONLY public.permissions DROP CONSTRAINT permissions_name_guard_name_unique;
       public            tripteki    false    246    246            u           2606    423634    permissions permissions_pkey 
   CONSTRAINT     Z   ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);
 F   ALTER TABLE ONLY public.permissions DROP CONSTRAINT permissions_pkey;
       public            tripteki    false    246            �           2606    423698 2   personal_access_tokens personal_access_tokens_pkey 
   CONSTRAINT     p   ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);
 \   ALTER TABLE ONLY public.personal_access_tokens DROP CONSTRAINT personal_access_tokens_pkey;
       public            tripteki    false    253            �           2606    423701 :   personal_access_tokens personal_access_tokens_token_unique 
   CONSTRAINT     v   ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);
 d   ALTER TABLE ONLY public.personal_access_tokens DROP CONSTRAINT personal_access_tokens_token_unique;
       public            tripteki    false    253            �           2606    423684 .   role_has_permissions role_has_permissions_pkey 
   CONSTRAINT     �   ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_pkey PRIMARY KEY (permission_id, role_id);
 X   ALTER TABLE ONLY public.role_has_permissions DROP CONSTRAINT role_has_permissions_pkey;
       public            tripteki    false    251    251            w           2606    423647 "   roles roles_name_guard_name_unique 
   CONSTRAINT     i   ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_guard_name_unique UNIQUE (name, guard_name);
 L   ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_name_guard_name_unique;
       public            tripteki    false    248    248            y           2606    423645    roles roles_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.roles DROP CONSTRAINT roles_pkey;
       public            tripteki    false    248            G           2606    423482    sessions sessions_pkey 
   CONSTRAINT     T   ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
 @   ALTER TABLE ONLY public.sessions DROP CONSTRAINT sessions_pkey;
       public            tripteki    false    221            @           2606    423468    users users_email_unique 
   CONSTRAINT     T   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);
 B   ALTER TABLE ONLY public.users DROP CONSTRAINT users_email_unique;
       public            tripteki    false    219            B           2606    423466    users users_pkey 
   CONSTRAINT     N   ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
 :   ALTER TABLE ONLY public.users DROP CONSTRAINT users_pkey;
       public            tripteki    false    219            m           2606    423591    worktypes worktypes_pkey 
   CONSTRAINT     V   ALTER TABLE ONLY public.worktypes
    ADD CONSTRAINT worktypes_pkey PRIMARY KEY (id);
 B   ALTER TABLE ONLY public.worktypes DROP CONSTRAINT worktypes_pkey;
       public            tripteki    false    240            h           1259    423705    clocks_eh_employee_id_index    INDEX     X   CREATE INDEX clocks_eh_employee_id_index ON public.clocks USING btree (eh_employee_id);
 /   DROP INDEX public.clocks_eh_employee_id_index;
       public            tripteki    false    238            i           1259    423581    clocks_eh_kiosk_id_index    INDEX     R   CREATE INDEX clocks_eh_kiosk_id_index ON public.clocks USING btree (eh_kiosk_id);
 ,   DROP INDEX public.clocks_eh_kiosk_id_index;
       public            tripteki    false    238            O           1259    423508    jobs_queue_index    INDEX     B   CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);
 $   DROP INDEX public.jobs_queue_index;
       public            tripteki    false    225            z           1259    423651 /   model_has_permissions_model_id_model_type_index    INDEX     �   CREATE INDEX model_has_permissions_model_id_model_type_index ON public.model_has_permissions USING btree (model_id, model_type);
 C   DROP INDEX public.model_has_permissions_model_id_model_type_index;
       public            tripteki    false    249    249            }           1259    423662 )   model_has_roles_model_id_model_type_index    INDEX     u   CREATE INDEX model_has_roles_model_id_model_type_index ON public.model_has_roles USING btree (model_id, model_type);
 =   DROP INDEX public.model_has_roles_model_id_model_type_index;
       public            tripteki    false    250    250            �           1259    423699 8   personal_access_tokens_tokenable_type_tokenable_id_index    INDEX     �   CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);
 L   DROP INDEX public.personal_access_tokens_tokenable_type_tokenable_id_index;
       public            tripteki    false    253    253            E           1259    423484    sessions_last_activity_index    INDEX     Z   CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);
 0   DROP INDEX public.sessions_last_activity_index;
       public            tripteki    false    221            H           1259    423483    sessions_user_id_index    INDEX     N   CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);
 *   DROP INDEX public.sessions_user_id_index;
       public            tripteki    false    221            �           2606    423616 7   employee_worktype employee_worktype_employee_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.employee_worktype
    ADD CONSTRAINT employee_worktype_employee_id_foreign FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.employee_worktype DROP CONSTRAINT employee_worktype_employee_id_foreign;
       public          tripteki    false    3677    230    244            �           2606    423621 7   employee_worktype employee_worktype_worktype_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.employee_worktype
    ADD CONSTRAINT employee_worktype_worktype_id_foreign FOREIGN KEY (worktype_id) REFERENCES public.worktypes(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.employee_worktype DROP CONSTRAINT employee_worktype_worktype_id_foreign;
       public          tripteki    false    244    240    3693            �           2606    423599 7   location_worktype location_worktype_location_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.location_worktype
    ADD CONSTRAINT location_worktype_location_id_foreign FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.location_worktype DROP CONSTRAINT location_worktype_location_id_foreign;
       public          tripteki    false    242    3681    232            �           2606    423604 7   location_worktype location_worktype_worktype_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.location_worktype
    ADD CONSTRAINT location_worktype_worktype_id_foreign FOREIGN KEY (worktype_id) REFERENCES public.worktypes(id) ON DELETE CASCADE;
 a   ALTER TABLE ONLY public.location_worktype DROP CONSTRAINT location_worktype_worktype_id_foreign;
       public          tripteki    false    240    242    3693            �           2606    423652 A   model_has_permissions model_has_permissions_permission_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.model_has_permissions
    ADD CONSTRAINT model_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;
 k   ALTER TABLE ONLY public.model_has_permissions DROP CONSTRAINT model_has_permissions_permission_id_foreign;
       public          tripteki    false    3701    249    246            �           2606    423663 /   model_has_roles model_has_roles_role_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.model_has_roles
    ADD CONSTRAINT model_has_roles_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
 Y   ALTER TABLE ONLY public.model_has_roles DROP CONSTRAINT model_has_roles_role_id_foreign;
       public          tripteki    false    248    250    3705            �           2606    423673 ?   role_has_permissions role_has_permissions_permission_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_permission_id_foreign FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;
 i   ALTER TABLE ONLY public.role_has_permissions DROP CONSTRAINT role_has_permissions_permission_id_foreign;
       public          tripteki    false    3701    246    251            �           2606    423678 9   role_has_permissions role_has_permissions_role_id_foreign    FK CONSTRAINT     �   ALTER TABLE ONLY public.role_has_permissions
    ADD CONSTRAINT role_has_permissions_role_id_foreign FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;
 c   ALTER TABLE ONLY public.role_has_permissions DROP CONSTRAINT role_has_permissions_role_id_foreign;
       public          tripteki    false    248    3705    251            $   �  x��R�n�0<�W ߡ���EB�*��^#E��E^��E����P��R�uf�3;�ͅ;�ӥX�B�ka$jP��ZV����?hr"r)4X�G��5��ȕ= ��pR�N��E���V�U��(�VU9 m� �}'E�Ar�ZSr�%g�w��������8�CvQ;�Y��K�McO��i��"��$���3��ߕ��R�4m�-O�';�U!�8��n���7'��t�8F�҈u�pU��g^E'O^=
���<+����h3{~Xw�'v�M�����ୖ
t*/8E��<ߢca I^�u])�$S���$G��W+L�;���^���s|�p0b4
'���,�*!5�5�11L/���'[m�]�{%u&l�4�!��8�=�4ǎ����}�4t��Ocg2      %      x������ � �      4   ]   x�m���0�d�,`��'�	Ґ��#$D��U���Eb�B�"Hx�5��K��%�^����0�!�r���#[Tc�u+��l���]      2   I   x�mȱ�0�:L��> �d���#� ^yRD��kj�[>l������9ļF�E��_ʹ)�E�����^a H      :      x������ � �      ,   =  x���=o�6�k�W�K5���\�qÈ�+��c�U���n��_��!8`�	�@>z�}ƨ�u�O�-�^���>�e�q�m��������'��s%CwZfy�\,k��Y�Ω�bm�hZt�AI�!&���1������z�L��������Y��6y?�6�u��^x;�s��^��y�ȍ�j9�6_�A�b̪k6�g&'/|\!w E47Sk��Û��;���v��{z�~��Y�+/KN�溽(,�Fg��R������c!cJՒu������C@�|��|�\�v�vL�������T<�����Y��}?ϯ<�%_�Y��R��|}�^C�)B�Ub[\�*�Ħȸ�Ҁ�#0h��jt
UE�2}���}��u~�x:�RX2���u�7���u=*�"7C� �̑*#�4Zf�ڔ�>��N��$��?�$%d����U�6܌��>
_^�e��4|�F�v�q^7^�嫙wfc�5�����j��E�d+a@F%	�V�mP��"�}�e�q�L*H�o���>��8�aQ�U���t:M|�5��\��(��.V��/��,�r�*wt(����Ȋ_%��5H�ڋ��:cn�K�^tn��e���V��~���+�.�Ԟ�r΀��Hb䪫�$֫V��8�5��9����!���h)ԚnF���y���p�M�I����|<M��t�\Q�����2C$�T�@�r8��L{ߑ.�&�`u	"7V _��J�f���M�7R^?.�<�ßӷ��X�����P���E���(+��HmZ��u�Zf�X�����3��R*���/����/�����v      *      x������ � �      (      x������ � �      '      x������ � �      0   ?   x�3�442�4���K��K-�L�4202�50�54S02�26�20�*f`fel b�@\1z\\\ ��      8      x������ � �      .   1   x�3���K��K-�L�4C##S]]C3#+cs+lb\1z\\\ ���         +  x�m�ݎ� F���l~,}�M�٬+J#��o_��ѺF��9�7���1��.�q#ڄf�8F����	*~ a�u�X@q �
��+(O�qe�0�l @��͇"�jsP�
��lj�@p���P\�p׆�yޓR��G��RM��݁UƐ�lξy��;K���0v�q��lGstk�E#v� M5J���ߖ\D��,��ط1��<μ ^�l9�0�iLL6M����:H2�L���p���-E�%�5�M��uY��77uQ!/]�`K����uL������%�X�ﯪ������      ?      x������ � �      @   +   x�3�t,(����OI�)��	-N-�4�2�"j�e�U4F��� 9D�      "      x������ � �      <   H   x�3�,�L-W���/��,OM�4202�50�54S02�26�24�&�e�Y�ZR��Z�
ѬP����G�1z\\\ >�x      C      x������ � �      A      x�3�4�2�4�2�=... !
      >   <   x�3�LL����,OM�4202�50�54S02�26�24�&�eę��_��C�!61�=... 1��      #   �  x��Qۮ�@}֯�}�a�(=��EI"wH_�)��E������$������d�Y{��%�;z�~��z�T/Ao߃M��P��Q]K���?��j��g�Pܶ�RZ ��
|ȭ~����j9p�����Jo����+gVř,!�+�3�:�i�>�%>��@�&���r8�9ޯ
J �΂�Ku����v�`��a��#2ˍ45I���&�ef(mH]�Ol�E7b�2���1F���3��>B�o��it���(�el������I�sY_?rSi�h"�`�9�H�<2�>
8�Tǎ�z�rӠ�v�bޞސ��[���S~뻧q�׎�u��ò�[EH#�h�-N|��='�¨K$[�L�ӆu	i�i���g�������dr�}ƯDq-J"��x���qm�>������"A���7��_��k�}�u�N�^ԊQk�*L�UNAl5٥�#M�Pc����R���Q>�3K���?�J^�?���̀Ge      !   �   x�3�tL����L����9�z����FF��&��f
FV��V��*F�*�F*����9%>��ay��!�.���Q!Y�)��z��^.A>�敥�ٕ��٦����NQai���X��"�e�Z�Z�Y
$h�6W7��d��P������ ��U�      6      x������ � �     