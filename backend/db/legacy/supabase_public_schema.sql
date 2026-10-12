--
-- PostgreSQL database dump
--

\restrict C9P6WeT7cUR3YQYHev4eq17KnCH7s9LELNKifU4WDeVEOqjlvleTGSFJvc1IB7A

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at)
  on conflict (id) do nothing;

  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: kivirik_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kivirik_answers (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    user_subscription_id uuid,
    question_key text NOT NULL,
    period text NOT NULL,
    answer text NOT NULL,
    value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kivirik_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.kivirik_answers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: kivirik_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.kivirik_answers_id_seq OWNED BY public.kivirik_answers.id;


--
-- Name: kivirik_dismissals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kivirik_dismissals (
    user_id uuid NOT NULL,
    question_key text NOT NULL,
    user_subscription_id uuid,
    until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    catalog_id uuid NOT NULL,
    price numeric(10,2) NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    new_price numeric(10,2),
    source text DEFAULT 'scanner'::text NOT NULL,
    CONSTRAINT price_history_source_check CHECK ((source = ANY (ARRAY['scanner'::text, 'admin'::text])))
);


--
-- Name: price_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_reports (
    id bigint NOT NULL,
    catalog_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reported_price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT price_reports_reported_price_check CHECK ((reported_price > (0)::numeric))
);


--
-- Name: price_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.price_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: price_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.price_reports_id_seq OWNED BY public.price_reports.id;


--
-- Name: subscriptions_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_name text NOT NULL,
    plan_name text,
    current_price numeric(10,2),
    currency text DEFAULT 'TRY'::text NOT NULL,
    source_url text,
    last_checked_at timestamp with time zone,
    category text,
    cancel_url text,
    domain text,
    logo_url text,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    managed_by text,
    status text DEFAULT 'active'::text NOT NULL,
    price_status text DEFAULT 'unverified'::text NOT NULL,
    source_note text,
    CONSTRAINT subscriptions_catalog_active_needs_price_check CHECK (((status <> 'active'::text) OR (current_price IS NOT NULL))),
    CONSTRAINT subscriptions_catalog_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT subscriptions_catalog_category_check CHECK ((category = ANY (ARRAY['Video/Dizi-Film'::text, 'Müzik'::text, 'Kitap/Sesli Kitap'::text, 'Yapay Zeka'::text, 'Bulut Depolama'::text, 'Üretkenlik/Tasarım'::text, 'Oyun'::text, 'Alışveriş/Üyelik'::text, 'VPN/Güvenlik'::text, 'Spor'::text]))),
    CONSTRAINT subscriptions_catalog_managed_by_check CHECK (((managed_by IS NULL) OR (managed_by = 'revenuecat'::text))),
    CONSTRAINT subscriptions_catalog_price_status_check CHECK ((price_status = ANY (ARRAY['unverified'::text, 'verified'::text]))),
    CONSTRAINT subscriptions_catalog_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'hidden'::text])))
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    amount numeric(10,2) NOT NULL,
    category text,
    description text,
    date date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: user_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    reminder_days_before smallint,
    is_student boolean,
    monthly_budget numeric(10,2),
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_settings_monthly_budget_check CHECK (((monthly_budget IS NULL) OR (monthly_budget >= (0)::numeric))),
    CONSTRAINT user_settings_reminder_days_before_check CHECK (((reminder_days_before IS NULL) OR (reminder_days_before = ANY (ARRAY[0, 1, 3, 7]))))
);


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    catalog_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    usage_frequency text,
    price_alert_enabled boolean DEFAULT true NOT NULL,
    billing_date integer,
    reason text,
    billing_month integer,
    custom_price numeric(10,2),
    custom_currency text,
    payment_channel text,
    share_count smallint,
    is_trial boolean,
    trial_ends_at date,
    planned_end_at date,
    cancelled_at timestamp with time zone,
    CONSTRAINT user_subscriptions_billing_date_check CHECK (((billing_date IS NULL) OR ((billing_date >= 1) AND (billing_date <= 31)))),
    CONSTRAINT user_subscriptions_billing_month_check CHECK (((billing_month IS NULL) OR ((billing_month >= 1) AND (billing_month <= 12)))),
    CONSTRAINT user_subscriptions_billing_month_needs_day_check CHECK (((billing_month IS NULL) OR (billing_date IS NOT NULL))),
    CONSTRAINT user_subscriptions_payment_channel_check CHECK (((payment_channel IS NULL) OR (payment_channel = ANY (ARRAY['app_store'::text, 'google_play'::text, 'web_card'::text, 'operator'::text, 'someone_else'::text])))),
    CONSTRAINT user_subscriptions_share_count_check CHECK (((share_count IS NULL) OR ((share_count >= 1) AND (share_count <= 20)))),
    CONSTRAINT user_subscriptions_usage_frequency_check CHECK (((usage_frequency IS NULL) OR (usage_frequency = ANY (ARRAY['Her gün'::text, 'Haftada birkaç kez'::text, 'Ayda birkaç kez'::text, 'Neredeyse hiç'::text]))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan text DEFAULT 'free'::text NOT NULL,
    premium_expires_at timestamp with time zone,
    eriste_dismissed boolean DEFAULT false NOT NULL,
    CONSTRAINT users_plan_check CHECK ((plan = ANY (ARRAY['free'::text, 'premium'::text])))
);


--
-- Name: kivirik_answers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_answers ALTER COLUMN id SET DEFAULT nextval('public.kivirik_answers_id_seq'::regclass);


--
-- Name: price_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_reports ALTER COLUMN id SET DEFAULT nextval('public.price_reports_id_seq'::regclass);


--
-- Name: kivirik_answers kivirik_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_answers
    ADD CONSTRAINT kivirik_answers_pkey PRIMARY KEY (id);


--
-- Name: kivirik_answers kivirik_answers_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_answers
    ADD CONSTRAINT kivirik_answers_unique UNIQUE NULLS NOT DISTINCT (user_id, user_subscription_id, question_key, period);


--
-- Name: kivirik_dismissals kivirik_dismissals_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_dismissals
    ADD CONSTRAINT kivirik_dismissals_unique UNIQUE NULLS NOT DISTINCT (user_id, user_subscription_id, question_key);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: price_reports price_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_reports
    ADD CONSTRAINT price_reports_pkey PRIMARY KEY (id);


--
-- Name: subscriptions_catalog subscriptions_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions_catalog
    ADD CONSTRAINT subscriptions_catalog_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_settings user_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_user_id_catalog_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_catalog_id_key UNIQUE (user_id, catalog_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_kivirik_answers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kivirik_answers_user_id ON public.kivirik_answers USING btree (user_id);


--
-- Name: idx_price_history_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_history_catalog_id ON public.price_history USING btree (catalog_id);


--
-- Name: idx_price_reports_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_price_reports_catalog_id ON public.price_reports USING btree (catalog_id);


--
-- Name: idx_subscriptions_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_catalog_category ON public.subscriptions_catalog USING btree (category);


--
-- Name: idx_subscriptions_catalog_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_catalog_status ON public.subscriptions_catalog USING btree (status);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);


--
-- Name: idx_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: idx_user_subscriptions_catalog_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_catalog_id ON public.user_subscriptions USING btree (catalog_id);


--
-- Name: idx_user_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);


--
-- Name: kivirik_answers kivirik_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_answers
    ADD CONSTRAINT kivirik_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kivirik_answers kivirik_answers_user_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_answers
    ADD CONSTRAINT kivirik_answers_user_subscription_id_fkey FOREIGN KEY (user_subscription_id) REFERENCES public.user_subscriptions(id) ON DELETE CASCADE;


--
-- Name: kivirik_dismissals kivirik_dismissals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_dismissals
    ADD CONSTRAINT kivirik_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: kivirik_dismissals kivirik_dismissals_user_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kivirik_dismissals
    ADD CONSTRAINT kivirik_dismissals_user_subscription_id_fkey FOREIGN KEY (user_subscription_id) REFERENCES public.user_subscriptions(id) ON DELETE CASCADE;


--
-- Name: price_history price_history_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.subscriptions_catalog(id) ON DELETE CASCADE;


--
-- Name: price_reports price_reports_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_reports
    ADD CONSTRAINT price_reports_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.subscriptions_catalog(id) ON DELETE CASCADE;


--
-- Name: price_reports price_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_reports
    ADD CONSTRAINT price_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_settings user_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_catalog_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_catalog_id_fkey FOREIGN KEY (catalog_id) REFERENCES public.subscriptions_catalog(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: kivirik_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kivirik_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: kivirik_answers kivirik_answers_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kivirik_answers_select_own ON public.kivirik_answers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: kivirik_dismissals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kivirik_dismissals ENABLE ROW LEVEL SECURITY;

--
-- Name: kivirik_dismissals kivirik_dismissals_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kivirik_dismissals_select_own ON public.kivirik_dismissals FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: price_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

--
-- Name: price_history price_history_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY price_history_select_public ON public.price_history FOR SELECT USING (true);


--
-- Name: price_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: price_reports price_reports_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY price_reports_select_own ON public.price_reports FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions_catalog subscriptions_catalog_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_catalog_select_public ON public.subscriptions_catalog FOR SELECT USING (true);


--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_select_own ON public.transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: user_settings user_settings_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_settings_select_own ON public.user_settings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions user_subscriptions_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_subscriptions_select_own ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: users users_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_select_own ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: users users_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_own ON public.users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- PostgreSQL database dump complete
--

\unrestrict C9P6WeT7cUR3YQYHev4eq17KnCH7s9LELNKifU4WDeVEOqjlvleTGSFJvc1IB7A

