(function () {
    var images = [
        "8120rEkVzsL._AC_UL480_FMwebp_QL65_.webp",
        "imgi_115_816hywlmu-L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_121_81Y3J1ghwrL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_122_818fOuBHTnL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_124_81iDNjn-r3L._AC_UL960_FMwebp_QL65_.jpg",
        "imgi_136_81Q6apsioXL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_142_81FQ6Qh-QML._AC_UL960_FMwebp_QL65_.webp",
        "imgi_143_81zOiwpvBZL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_148_81-pWIX14OL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_154_81kHWcb7n4L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_176_91UbyqB3M1L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_179_81boY6SfrML._AC_UL960_FMwebp_QL65_.webp",
        "imgi_181_81s9QZfxwkL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_187_81GIb6GMhRL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_190_81s8xJUzWGL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_196_81MtRphUrSL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_197_71nn0Eha6zL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_202_91nunbvU04L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_205_81IyWObKlCL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_206_91sto0gDwPL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_208_81fNp2prCvL._AC_UL960_FMwebp_QL65_.jpg",
        "imgi_211_91NxYvUNf6L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_212_81F29qU0YDL._AC_UL960_FMwebp_QL65_.jpg",
        "imgi_220_81IgJ1cGaWS._AC_UL960_FMwebp_QL65_.webp",
        "imgi_223_71vMGRog+iL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_229_815uHbvvu1L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_232_81VAgJoB3BL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_239_81b7ZvYp78L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_247_719shIU19XL._AC_UL800_FMwebp_QL65_.webp",
        "imgi_248_81qPzeEO5IL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_254_81BkEYmif6L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_263_81b37BGjBuL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_263_81wdZRhBjxL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_269_81mcLwpxXSL._AC_UL960_FMwebp_QL65_.jpg",
        "imgi_275_913XoI0vz7L._AC_UL960_FMwebp_QL65_.webp",
        "imgi_281_81vbN16NtXL._AC_UL960_FMwebp_QL65_.webp",
        "imgi_287_81Z85oL1xvL._AC_UL960_FMwebp_QL65_.webp"
    ];
    var basePath = "images/manga/";
    var container = document.body;
    images.forEach(function (img) {
        var div = document.createElement("div");
        div.className = "img-container";
        var imgEl = document.createElement("img");
        imgEl.src = basePath + img;
        imgEl.alt = img;
        var p = document.createElement("p");
        p.textContent = img;
        div.appendChild(imgEl);
        div.appendChild(p);
        container.appendChild(div);
    });
})();
