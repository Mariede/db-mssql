'use strict';

/*
Propriedades de conexao e configuracoes gerais
*/
const msSqlServer = {
	connectionType: 1,
	configDb: {
		user: 'user',
		password: 'pass',
		server: 'server',
		port: 1433,
		database: 'database',
		connectionTimeout: 15000,
		requestTimeout: 15000,
		stream: false,
		arrayRowMode: false,
		parseJSON: true,
		options: {
			abortTransactionOnError: true,
			enableArithAbort: true,
			useUTC: false,
			encrypt: false,
			trustServerCertificate: false,
			instanceName: ''
		},
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000
		}
	}
};

module.exports = {
	msSqlServer
};
