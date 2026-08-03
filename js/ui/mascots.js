/**
 * mascots.js -- Registro de mascotas seleccionables (ademas de Rimuru).
 *
 * GENERADO por tools/slice-mascots.py a partir de las hojas de
 * tools/mascot-sheets/. No editar a mano: se sobrescribe.
 * mascot.js lee window.MascotRegistry y lo suma a la lista del selector.
 *
 * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una
 * imagen por fotograma), ya normalizadas a un lienzo cuadrado con los
 * pies anclados abajo-centro.
 */
window.MascotRegistry = [
    {
        "id": "ichigo",
        "name": "Ichigo Kurosaki",
        "anime": "Bleach",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/ichigo/idle-0.png",
                "images/mascots/ichigo/idle-1.png",
                "images/mascots/ichigo/idle-2.png"
            ],
            "walk": [
                "images/mascots/ichigo/walk-0.png",
                "images/mascots/ichigo/walk-1.png",
                "images/mascots/ichigo/walk-2.png"
            ],
            "attack": [
                "images/mascots/ichigo/attack-0.png",
                "images/mascots/ichigo/attack-1.png",
                "images/mascots/ichigo/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 5
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 10
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        }
    },
    {
        "id": "kenpachi",
        "name": "Kenpachi Zaraki",
        "anime": "Bleach",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kenpachi/idle-0.png"
            ],
            "walk": [
                "images/mascots/kenpachi/walk-0.png",
                "images/mascots/kenpachi/walk-1.png",
                "images/mascots/kenpachi/walk-2.png",
                "images/mascots/kenpachi/walk-3.png",
                "images/mascots/kenpachi/walk-4.png",
                "images/mascots/kenpachi/walk-5.png",
                "images/mascots/kenpachi/walk-6.png",
                "images/mascots/kenpachi/walk-7.png"
            ],
            "attack": [
                "images/mascots/kenpachi/attack-0.png",
                "images/mascots/kenpachi/attack-1.png",
                "images/mascots/kenpachi/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0
                ],
                "fps": 4
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                    7
                ],
                "fps": 11
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        }
    }
];
