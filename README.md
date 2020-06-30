# db-mssql

Biblioteca para interfacear conexões e execução de queries (inserts, updates, deletes, selects) no **MS SQL Server**, de forma transacional, através do pacote [NODE mssql](https://github.com/tediousjs/node-mssql)

## Padrão de entrada

  1. Estrutura básica das queries (padrão de entrada)

```
query = {
	formato: 1, // 1: Query String, 2: Stored Procedure
	dados: {
		input: [
			... // Parâmetros de entrada para execução da consulta (ou consultas)
		],
		output: [
			... // Parâmetros de saída (advindo de variáveis OUTPUT, mais exemplos abaixo)
		],
		executar: `
			... // Query ou queries SQL
		`
	}
}
```

  2. Exemplos

```
const query = {
	formato: 1,
	dados: {
		input: [
			['nome', '%Nome A%']
		],
		executar: 'SELECT ID_USUARIO, NOME FROM USUARIO (NOLOCK) WHERE NOME LIKE(@nome);'
	}
};
```

```
query = {
	formato: 1,
	dados: {
		input: [
			['id', 'int', 1],
			['nome', 'varchar(200)', '%Nome B%']
		],
		output: [
			['QTD_RET', 'int']
		],
		executar: `
			SELECT * FROM TABELA T (NOLOCK) WHERE T.ID_TABELA=@id OR T.NOME LIKE(@nome);
			SET @QTD_RET = SCOPE_IDENTITY();
		`
	}
}
```

```
query = {
	formato: 2,
	dados: {
		input: [
			['id', 'int', 1],
			['nome', 'varchar(200)', 'Nome C']
		],
		output: [
			['QTD_RET', 'int']
		],
		executar: 'USUARIO_CONSULTAR'
	}
}
```

> **input** pode utilizar formato de chamada com dois ou três parâmetros de entrada. No caso de dois parâmetros omite-se o tipo do dado

  3. Método padrão de chamada na lib: **sqlExecuteAll(query)**, com pool de conexão ativo

## Padrão de saída

###  Não paginado

  * Apenas um recordset de retorno

```
{
	"recordset": [
		{
			...
		},
		{
			...
		}
	],
	"rowsAffected": 0,
	"output": {}, // Se existir
	"returnValue": 0 // Se existir
}
```

  * Mais de um recordset de retorno

```
{
	"recordsets": [
		[
			{
				...
			},
			{
				...
			}
		],
		[
			{
				...
			},
			{
				...
			}
		]
	],
	"rowsAffected": [
		0,
		0
	],
	"output": {}, // Se existir
	"returnValue": 0 // Se existir
}
```

###  Paginado

  * Usa a lib paginator (setPage)

```
{
	"pageDetails": {
		"currentPage": 1,
		"itemsPerPage": 10,
		"itemsFrom": 0,
		"itemsTo": 0,
		"itemsCount": 0,
		"totalPages": 0
	},
	"recordset": [
		{
			...
		},
		{
			...
		}
	],
	"rowsAffected": 0,
	"output": {}, // Se existir
	"returnValue": 0 // Se existir
}
```

## Exemplos de uso

  * Scripts simples de teste para demonstração, via linha de comando

```
'use strict';

const dbCon = require('./db');

new Promise(() => {
	const query = {
		formato: 1,
		dados: {
			input: [
				['nome', '%jo%']
			],
			executar: `
				SELECT
					ID_USUARIO
					,NOME
					,ATIVO
				FROM
					USUARIO (NOLOCK)
				WHERE
					NOME LIKE(@nome);
			`
		}
	};

	// Executa query ou queries
	dbCon.msSqlServer.sqlExecuteAll(query)
	.then(
		result => {
			console.info(result);
		}
	)
	.catch(
		err => {
			console.error(err.message || err);
		}
	)
	.finally(
		() => {
			/*
				Sai apos efetivar a promessa
					-> apenas para o caso de pool de conexao ativo
			*/
			process.exit(0);
		}
	);
});
```

```
'use strict';

const dbCon = require('./db');

new Promise(() => {
	const query = {
		formato: 1,
		dados: {
			input: [
				['tipo', '%beta%']
			],
			output: [
				['ID_TIPO', 'int']
			],
			executar: `
				SET @ID_TIPO = (
					SELECT TOP 1
						ID_TIPO
					FROM
						TIPO (NOLOCK)
					WHERE
						TIPO LIKE(@tipo)
					ORDER BY
						TIPO DESC
				);

				SELECT
					U.ID_USUARIO
					,U.NOME
					,U.ATIVO
					,T.TIPO
				FROM
					USUARIO U (NOLOCK)
					INNER JOIN TIPO T (NOLOCK)
						ON (U.ID_TIPO = T.ID_TIPO)
				WHERE
					U.ID_TIPO = @ID_TIPO;
			`
		}
	};

	// Executa query ou queries
	dbCon.msSqlServer.sqlExecuteAll(query)
	.then(
		result => {
			console.info(result);
		}
	)
	.catch(
		err => {
			console.error(err.message || err);
		}
	)
	.finally(
		() => {
			/*
				Sai apos efetivar a promessa
					-> apenas para o caso de pool de conexao ativo
			*/
			process.exit(0);
		}
	);
});
```

> mais enxuto e elegante se trabalhar com async await, ex:

```
...
const result = await dbCon.msSqlServer.sqlExecuteAll(query);
return result;
...
```

## Arquivo db-config

  * Possui as configurações de conexão ao servidor de banco de dados. Mais detalhes [aqui](https://github.com/tediousjs/node-mssql#general-same-for-all-drivers)

  	- Se **connectionType** for igual a 2 realiza conexão direta sem pool
  	- Se **connectionType** for diferente de 2 realiza conexão com pool (recomendado)


