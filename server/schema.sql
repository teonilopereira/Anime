IF DB_ID(N'AnimeDestiny') IS NULL
BEGIN
    CREATE DATABASE AnimeDestiny;
END;
GO

USE AnimeDestiny;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        username NVARCHAR(64) NOT NULL UNIQUE,
        email NVARCHAR(128) NULL UNIQUE,
        pw_hash CHAR(64) NOT NULL,
        created_at BIGINT NOT NULL
    );
END;
GO

IF COL_LENGTH(N'dbo.users', N'email') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD email NVARCHAR(128) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_users_email' AND object_id = OBJECT_ID(N'dbo.users'))
BEGIN
    CREATE UNIQUE INDEX UX_users_email ON dbo.users(email) WHERE email IS NOT NULL;
END;
GO

IF OBJECT_ID(N'dbo.sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sessions (
        token NVARCHAR(64) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL,
        created_at BIGINT NOT NULL,
        CONSTRAINT FK_sessions_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.item_state', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.item_state (
        user_id INT NOT NULL,
        category NVARCHAR(32) NOT NULL,
        item_id NVARCHAR(64) NOT NULL,
        fav BIT NOT NULL CONSTRAINT DF_item_state_fav DEFAULT(0),
        viewed BIT NOT NULL CONSTRAINT DF_item_state_viewed DEFAULT(0),
        updated_at BIGINT NOT NULL,
        CONSTRAINT PK_item_state PRIMARY KEY (user_id, category, item_id),
        CONSTRAINT FK_item_state_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.progress', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.progress (
        user_id INT NOT NULL,
        category NVARCHAR(32) NOT NULL,
        item_id NVARCHAR(64) NOT NULL,
        pkey NVARCHAR(64) NOT NULL,
        value BIT NOT NULL CONSTRAINT DF_progress_value DEFAULT(0),
        updated_at BIGINT NOT NULL,
        CONSTRAINT PK_progress PRIMARY KEY (user_id, category, item_id, pkey),
        CONSTRAINT FK_progress_users FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.catalog_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.catalog_items (
        category NVARCHAR(32) NOT NULL,
        item_id NVARCHAR(64) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        image NVARCHAR(512) NOT NULL,
        info NVARCHAR(255) NULL,
        price INT NULL,
        status NVARCHAR(64) NULL,
        class_name NVARCHAR(32) NULL,
        demografia NVARCHAR(32) NULL,
        detail_json NVARCHAR(MAX) NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT PK_catalog_items PRIMARY KEY (category, item_id)
    );
END;
GO
