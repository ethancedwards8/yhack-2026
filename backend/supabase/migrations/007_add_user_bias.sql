alter table users add column if not exists bias float default 0.5
    check (bias >= 0.0 and bias <= 1.0);
