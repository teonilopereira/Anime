(function (window) {
    "use strict";

    const CATEGORY_SET = new Set(["anime", "manga", "juegos", "novelas", "detalle"]);

    function isValidCategory(value) {
        return CATEGORY_SET.has(String(value || "").toLowerCase());
    }

    function isValidId(value) {
        return /^[a-z]?\d+$/i.test(String(value || "").trim());
    }

    function getSafeCategory(value, fallback = "manga") {
        const category = String(value || "").toLowerCase();
        return isValidCategory(category) ? category : fallback;
    }

    function getSafeUrlParams(search = window.location.search) {
        const params = new URLSearchParams(search);
        const id = params.get("id") || "";
        const cat = params.get("cat") || params.get("categoria") || "";
        return {
            id: isValidId(id) ? id : "",
            nombre: params.get("nombre") || "",
            cat: getSafeCategory(cat, "manga")
        };
    }

    window.AppValidator = Object.freeze({
        isValidCategory,
        isValidId,
        getSafeCategory,
        getSafeUrlParams
    });
})(window);
