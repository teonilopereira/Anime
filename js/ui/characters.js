/**
 * characters.js -- Registro de personajes seleccionables.
 *
 * GENERADO por tools/slice-characters.py a partir de las hojas de
 * tools/character-sheets/. No editar a mano: se sobrescribe.
 * mascot.js lee window.CharacterRegistry (ademas de MascotRegistry) y lo
 * suma a la lista del selector.
 *
 * Cada entrada trae animaciones idle/walk/attack en modo 'frames' (una
 * imagen por fotograma), normalizadas a un lienzo cuadrado con los pies
 * anclados abajo-centro, y —si aplica— un 'projectile' con el efecto del
 * ataque.
 */
window.CharacterRegistry = [
    {
        "id": "aurora",
        "name": "Aurora",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/aurora/idle-0.png",
                "images/mascots/aurora/idle-1.png",
                "images/mascots/aurora/idle-2.png"
            ],
            "walk": [
                "images/mascots/aurora/walk-0.png",
                "images/mascots/aurora/walk-1.png",
                "images/mascots/aurora/walk-2.png"
            ],
            "attack": [
                "images/mascots/aurora/attack-0.png",
                "images/mascots/aurora/attack-1.png",
                "images/mascots/aurora/attack-2.png"
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
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/aurora/projectile.png"
    },
    {
        "id": "escarlata",
        "name": "Escarlata",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/escarlata/idle-0.png",
                "images/mascots/escarlata/idle-1.png",
                "images/mascots/escarlata/idle-2.png"
            ],
            "walk": [
                "images/mascots/escarlata/walk-0.png",
                "images/mascots/escarlata/walk-1.png",
                "images/mascots/escarlata/walk-2.png"
            ],
            "attack": [
                "images/mascots/escarlata/attack-0.png",
                "images/mascots/escarlata/attack-1.png",
                "images/mascots/escarlata/attack-2.png"
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
                "fps": 11
            }
        }
    },
    {
        "id": "nix",
        "name": "Nix",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/nix/idle-0.png",
                "images/mascots/nix/idle-1.png",
                "images/mascots/nix/idle-2.png"
            ],
            "walk": [
                "images/mascots/nix/walk-0.png",
                "images/mascots/nix/walk-1.png",
                "images/mascots/nix/walk-2.png"
            ],
            "attack": [
                "images/mascots/nix/attack-0.png",
                "images/mascots/nix/attack-1.png",
                "images/mascots/nix/attack-2.png"
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
        "id": "corvina",
        "name": "Corvina",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/corvina/idle-0.png",
                "images/mascots/corvina/idle-1.png",
                "images/mascots/corvina/idle-2.png"
            ],
            "walk": [
                "images/mascots/corvina/walk-0.png",
                "images/mascots/corvina/walk-1.png",
                "images/mascots/corvina/walk-2.png"
            ],
            "attack": [
                "images/mascots/corvina/attack-0.png",
                "images/mascots/corvina/attack-1.png",
                "images/mascots/corvina/attack-2.png"
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
        },
        "projectile": "images/mascots/corvina/projectile.png"
    },
    {
        "id": "kitsune",
        "name": "Kitsune",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kitsune/idle-0.png",
                "images/mascots/kitsune/idle-1.png",
                "images/mascots/kitsune/idle-2.png"
            ],
            "walk": [
                "images/mascots/kitsune/walk-0.png",
                "images/mascots/kitsune/walk-1.png",
                "images/mascots/kitsune/walk-2.png"
            ],
            "attack": [
                "images/mascots/kitsune/attack-0.png",
                "images/mascots/kitsune/attack-1.png",
                "images/mascots/kitsune/attack-2.png"
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
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/kitsune/projectile.png"
    },
    {
        "id": "vampi",
        "name": "Vampi",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/vampi/idle-0.png",
                "images/mascots/vampi/idle-1.png",
                "images/mascots/vampi/idle-2.png"
            ],
            "walk": [
                "images/mascots/vampi/walk-0.png",
                "images/mascots/vampi/walk-1.png",
                "images/mascots/vampi/walk-2.png"
            ],
            "attack": [
                "images/mascots/vampi/attack-0.png",
                "images/mascots/vampi/attack-1.png",
                "images/mascots/vampi/attack-2.png"
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
        },
        "projectile": "images/mascots/vampi/projectile.png"
    },
    {
        "id": "marea",
        "name": "Marea",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/marea/idle-0.png",
                "images/mascots/marea/idle-1.png",
                "images/mascots/marea/idle-2.png"
            ],
            "walk": [
                "images/mascots/marea/walk-0.png",
                "images/mascots/marea/walk-1.png",
                "images/mascots/marea/walk-2.png"
            ],
            "attack": [
                "images/mascots/marea/attack-0.png",
                "images/mascots/marea/attack-1.png",
                "images/mascots/marea/attack-2.png"
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
                "fps": 9
            },
            "attack": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 12
            }
        },
        "projectile": "images/mascots/marea/projectile.png"
    },
    {
        "id": "infernal",
        "name": "Infernal",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/infernal/idle-0.png",
                "images/mascots/infernal/idle-1.png",
                "images/mascots/infernal/idle-2.png"
            ],
            "walk": [
                "images/mascots/infernal/walk-0.png",
                "images/mascots/infernal/walk-1.png",
                "images/mascots/infernal/walk-2.png"
            ],
            "attack": [
                "images/mascots/infernal/attack-0.png",
                "images/mascots/infernal/attack-1.png",
                "images/mascots/infernal/attack-2.png"
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
        },
        "projectile": "images/mascots/infernal/projectile.png"
    },
    {
        "id": "kurenai",
        "name": "Kurenai",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kurenai/idle-0.png",
                "images/mascots/kurenai/idle-1.png",
                "images/mascots/kurenai/idle-2.png"
            ],
            "walk": [
                "images/mascots/kurenai/walk-0.png",
                "images/mascots/kurenai/walk-1.png",
                "images/mascots/kurenai/walk-2.png"
            ],
            "attack": [
                "images/mascots/kurenai/attack-0.png",
                "images/mascots/kurenai/attack-1.png",
                "images/mascots/kurenai/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 6
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
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
        },
        "projectile": "images/mascots/kurenai/projectile.png"
    },
    {
        "id": "kazuha",
        "name": "Kazuha",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/kazuha/idle-0.png",
                "images/mascots/kazuha/idle-1.png",
                "images/mascots/kazuha/idle-2.png"
            ],
            "walk": [
                "images/mascots/kazuha/walk-0.png",
                "images/mascots/kazuha/walk-1.png",
                "images/mascots/kazuha/walk-2.png"
            ],
            "attack": [
                "images/mascots/kazuha/attack-0.png",
                "images/mascots/kazuha/attack-1.png",
                "images/mascots/kazuha/attack-2.png"
            ]
        },
        "anims": {
            "idle": {
                "f": [
                    0,
                    1,
                    2
                ],
                "fps": 6
            },
            "walk": {
                "f": [
                    0,
                    1,
                    2
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
        },
        "projectile": "images/mascots/kazuha/projectile.png"
    },
    {
        "id": "diablilla",
        "name": "Diablilla",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/diablilla/idle-0.png",
                "images/mascots/diablilla/idle-1.png",
                "images/mascots/diablilla/idle-2.png"
            ],
            "walk": [
                "images/mascots/diablilla/walk-0.png",
                "images/mascots/diablilla/walk-1.png",
                "images/mascots/diablilla/walk-2.png"
            ],
            "attack": [
                "images/mascots/diablilla/attack-0.png",
                "images/mascots/diablilla/attack-1.png",
                "images/mascots/diablilla/attack-2.png"
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
        },
        "projectile": "images/mascots/diablilla/projectile.png"
    },
    {
        "id": "valkiria",
        "name": "Valkiria",
        "anime": "Personaje",
        "mode": "frames",
        "frames": {
            "idle": [
                "images/mascots/valkiria/idle-0.png",
                "images/mascots/valkiria/idle-1.png",
                "images/mascots/valkiria/idle-2.png"
            ],
            "walk": [
                "images/mascots/valkiria/walk-0.png",
                "images/mascots/valkiria/walk-1.png",
                "images/mascots/valkiria/walk-2.png"
            ],
            "attack": [
                "images/mascots/valkiria/attack-0.png",
                "images/mascots/valkiria/attack-1.png",
                "images/mascots/valkiria/attack-2.png"
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
        },
        "projectile": "images/mascots/valkiria/projectile.png"
    }
];
