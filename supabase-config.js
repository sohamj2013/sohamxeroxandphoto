
// Supabase connection settings

window.SUPABASE_URL =
    "https://gjxqcdvdcnfjfupbpryw.supabase.co";

window.SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_uZltuV6ZLU3j9yB4I_BD9w_67O6DqGo";

window.supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
);
