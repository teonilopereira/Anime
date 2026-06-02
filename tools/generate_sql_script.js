const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(ROOT_DIR, 'datos.js');
const OUTPUT_FILE = path.join(ROOT_DIR, 'AnimeDestiny.sql');
const DATABASE_NAME = 'AnimeDestiny';

function esc(value) {
    return String(value).replaceAll("'", "''");
}

function sqlText(value) {
    if (value === null || value === undefined || value === '') return 'NULL';
    return `N'${esc(value)}'`;
}

function sqlNum(value) {
    if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return 'NULL';
    return String(Number(value));
}

function loadSource() {
    const code = fs.readFileSync(SOURCE_FILE, 'utf8');
    const sandbox = { console: { log() {}, warn() {}, error() {} } };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(`${code}\n;globalThis.__source = { DATOS_WEB, DETALLES_MANGA, DETALLES_ANIME, DETALLES_JUEGOS };`, sandbox, {
        filename: SOURCE_FILE,
        displayErrors: true
    });
    return sandbox.__source;
}

function detailMapFor(category, source) {
    if (category === 'manga') return source.DETALLES_MANGA || {};
    if (category === 'anime') return source.DETALLES_ANIME || {};
    if (category === 'juegos') return source.DETALLES_JUEGOS || {};
    return {};
}

function buildRows() {
    const source = loadSource();
    const catalog = source.DATOS_WEB || {};
    const rows = [];

    for (const category of ['manga', 'anime', 'juegos']) {
        const items = Array.isArray(catalog[category]) ? catalog[category] : [];
        const details = detailMapFor(category, source);
        for (const item of items) {
            const detail = details[item.id] || {};
            rows.push({
                category,
                itemId: item.id,
                title: item.titulo,
                image: item.img,
                info: item.info,
                price: Number.isFinite(Number(item.precio)) ? Number(item.precio) : null,
                status: item.status,
                className: item.clase,
                demografia: item.demografia,
                detailJson: JSON.stringify({ ...item, ...detail })
            });
        }
    }

    return rows;
}

function buildSchema() {
    return [
        `IF DB_ID(N'${DATABASE_NAME}') IS NULL`,
        'BEGIN',
        `    CREATE DATABASE [${DATABASE_NAME}];`,
        'END;',
        'GO',
        '',
        `USE [${DATABASE_NAME}];`,
        'GO',
        '',
        'IF OBJECT_ID(N\'dbo.users\', N\'U\') IS NULL',
        'BEGIN',
        '    CREATE TABLE dbo.users (',
        '        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,',
        '        username NVARCHAR(64) NOT NULL UNIQUE,',
        '        pw_hash CHAR(64) NOT NULL,',
        '        created_at BIGINT NOT NULL',
        '    );',
        'END;',
        'GO',
        '',
        'IF OBJECT_ID(N\'dbo.sessions\', N\'U\') IS NULL',
        'BEGIN',
        '    CREATE TABLE dbo.sessions (',
        '        token NVARCHAR(64) NOT NULL PRIMARY KEY,',
        '        user_id INT NOT NULL,',
        '        created_at BIGINT NOT NULL,',
        '        CONSTRAINT FK_sessions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE',
        '    );',
        'END;',
        'GO',
        '',
        'IF OBJECT_ID(N\'dbo.item_state\', N\'U\') IS NULL',
        'BEGIN',
        '    CREATE TABLE dbo.item_state (',
        '        user_id INT NOT NULL,',
        '        category NVARCHAR(32) NOT NULL,',
        '        item_id NVARCHAR(64) NOT NULL,',
        '        fav BIT NOT NULL CONSTRAINT DF_item_state_fav DEFAULT(0),',
        '        viewed BIT NOT NULL CONSTRAINT DF_item_state_viewed DEFAULT(0),',
        '        updated_at BIGINT NOT NULL,',
        '        CONSTRAINT PK_item_state PRIMARY KEY (user_id, category, item_id),',
        '        CONSTRAINT FK_item_state_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE',
        '    );',
        'END;',
        'GO',
        '',
        'IF OBJECT_ID(N\'dbo.progress\', N\'U\') IS NULL',
        'BEGIN',
        '    CREATE TABLE dbo.progress (',
        '        user_id INT NOT NULL,',
        '        category NVARCHAR(32) NOT NULL,',
        '        item_id NVARCHAR(64) NOT NULL,',
        '        pkey NVARCHAR(64) NOT NULL,',
        '        value BIT NOT NULL CONSTRAINT DF_progress_value DEFAULT(0),',
        '        updated_at BIGINT NOT NULL,',
        '        CONSTRAINT PK_progress PRIMARY KEY (user_id, category, item_id, pkey),',
        '        CONSTRAINT FK_progress_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE',
        '    );',
        'END;',
        'GO',
        '',
        'IF OBJECT_ID(N\'dbo.catalog_items\', N\'U\') IS NULL',
        'BEGIN',
        '    CREATE TABLE dbo.catalog_items (',
        '        category NVARCHAR(32) NOT NULL,',
        '        item_id NVARCHAR(64) NOT NULL,',
        '        title NVARCHAR(255) NOT NULL,',
        '        image NVARCHAR(512) NOT NULL,',
        '        info NVARCHAR(255) NULL,',
        '        price INT NULL,',
        '        status NVARCHAR(64) NULL,',
        '        class_name NVARCHAR(32) NULL,',
        '        demografia NVARCHAR(32) NULL,',
        '        detail_json NVARCHAR(MAX) NULL,',
        '        updated_at BIGINT NOT NULL,',
        '        CONSTRAINT PK_catalog_items PRIMARY KEY (category, item_id)',
        '    );',
        'END;',
        'GO',
        ''
    ].join('\n');
}

function buildCatalogInserts(rows) {
    const lines = [];
    lines.push('SET NOCOUNT ON;');
    lines.push('DELETE FROM dbo.catalog_items;');
    lines.push('');

    const batchSize = 50;
    for (let index = 0; index < rows.length; index += batchSize) {
        const batch = rows.slice(index, index + batchSize);
        lines.push('INSERT INTO dbo.catalog_items (category, item_id, title, image, info, price, status, class_name, demografia, detail_json, updated_at)');
        lines.push('VALUES');
        const values = batch.map((row) => `(${[
            sqlText(row.category),
            sqlText(row.itemId),
            sqlText(row.title),
            sqlText(row.image),
            sqlText(row.info),
            sqlNum(row.price),
            sqlText(row.status),
            sqlText(row.className),
            sqlText(row.demografia),
            sqlText(row.detailJson),
            Date.now()
        ].join(', ')})`);
        lines.push(values.join(',\n'));
        lines.push(';');
        lines.push('');
    }

    return lines.join('\n');
}

const rows = buildRows();
const sql = `${buildSchema()}\n${buildCatalogInserts(rows)}`;
fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');
console.log(`Escrito ${OUTPUT_FILE} con ${rows.length} items.`);
