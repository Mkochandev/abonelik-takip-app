-- user_subscriptions tablosuna, kullanıcının aboneliğe neden sahip
-- olduğunu (isteğe bağlı) tutan bir kolon ekler.

alter table user_subscriptions add column reason text;
