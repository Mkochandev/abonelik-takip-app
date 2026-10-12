-- erişte Premium katalog kayıtlarının logosu web sitesinden gelir (eski API
-- alan adı abonelik-api.gaziustam.com kullanılmıyor).
update subscriptions_catalog
set logo_url = 'https://eriste.app/brand/eriste-ikon.png'
where managed_by = 'revenuecat';
