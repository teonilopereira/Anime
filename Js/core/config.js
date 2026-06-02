(function (window) {
    "use strict";

    const config = {
        anilistEndpoint: "https://graphql.anilist.co",
        apiBaseUrl: "",
        defaultPageSize: 40,
        maxCatalogItems: 40,
        debug: false,
        cachePrefix: "animeDestiny"
    };

    window.AppConfig = Object.freeze(config);
})(window);
