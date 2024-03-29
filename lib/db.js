'use strict';

// -------------------------------------------------------------------------
// Modulos de inicializacao
const sql = require('mssql');

// Arquivo config
const dbConfig = require('./db-config');
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Modulos de apoio
const errWrapper = require('./err-wrapper');
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Conexao e execucao de queries no MS SQL Server
const msSqlServer = {
	sqlOpenCon: () => { // Inicia uma transacao
		return new Promise((resolve, reject) => {
			const failReturn = err => {
				sql.close();
				reject(err);
			};

			try {
				if (dbConfig.msSqlServer.connectionType === 2) {
				// Conexao simples, direta, sem pool
					sql.connect(dbConfig.msSqlServer.configDb)
					.then(
						pool => {
							return new sql.Transaction(pool);
						}
					)
					.then(
						transaction => {
							return transaction.begin();
						}
					)
					.then(
						transaction => {
							resolve(transaction);
						}
					)
					.catch(
						err => {
							failReturn(err);
						}
					);
				} else {
				// DEFAULT - Conexao com pool
					new sql.ConnectionPool(dbConfig.msSqlServer.configDb).connect()
					.then(
						pool => {
							return new sql.Transaction(pool);
						}
					)
					.then(
						transaction => {
							return transaction.begin();
						}
					)
					.then(
						transaction => {
							resolve(transaction);
						}
					)
					.catch(
						err => {
							failReturn(err);
						}
					);
				}
			} catch (err) {
				failReturn(err);
			}
		});
	},

	sqlExecute: (transaction, params) => { // Executa uma query ou stored procedure para uma transacao
		return new Promise((resolve, reject) => {
			const failReturn = err => {
				sql.close();
				reject(err);
			};

			try {
				const request = new sql.Request(transaction);

				const sqlAction = async (r, p) => {
					if (Object.prototype.hasOwnProperty.call(p, 'formato') && Object.prototype.hasOwnProperty.call(p, 'dados')) {
						if (Object.prototype.hasOwnProperty.call(p.dados, 'executar')) {
							const dataTypeCheck = _param => {
								const validateE = _paramE => {
									return (
										_paramE ? (
											_paramE.split(',').map(
												element => {
													const iNum = parseFloat(element);
													return (isNaN(iNum) ? (element.trim().toUpperCase() === 'MAX' ? sql.MAX : element) : iNum);
												}
											)
										) : (
											_paramE
										)
									);
								};

								const dataTypesSupported = [
									'Bit',
									'BigInt',
									'Decimal',
									'Float',
									'Int',
									'Money',
									'Numeric',
									'SmallInt',
									'SmallMoney',
									'Real',
									'TinyInt',
									'Char',
									'NChar',
									'Text',
									'NText',
									'VarChar',
									'NVarChar',
									'Xml',
									'Time',
									'Date',
									'DateTime',
									'DateTime2',
									'DateTimeOffset',
									'SmallDateTime',
									'UniqueIdentifier',
									'Variant',
									'Binary',
									'VarBinary',
									'Image',
									'UDT',
									'Geography',
									'Geometry'
								];

								const param = String(_param || '');
								const checkParamA = param.indexOf('(');
								const checkParamB = checkParamA !== -1 ? checkParamA : param.length;
								const checkParamC = param.substr(0, checkParamB).trim();
								const checkParamD = dataTypesSupported.find(
									element => {
										return element.toUpperCase() === checkParamC.toUpperCase();
									}
								);
								const checkParamE = ((checkParamD && checkParamA !== -1) ? param.substr(checkParamA).replace(/[()]/g, '') : undefined);

								return { base: checkParamD, ext: validateE(checkParamE) };
							};

							const inputCheck = () => {
								if (Object.prototype.hasOwnProperty.call(p.dados, 'input')) {
									p.dados.input.forEach(key => {
										if (key.length === 3) {
											const dataType = dataTypeCheck(key[1]);

											if (dataType.base) {
												if (Array.isArray(dataType.ext)) {
													r.input(key[0], sql[dataType.base](...dataType.ext), key[2]);
												} else {
													r.input(key[0], sql[dataType.base], key[2]);
												}
											} else {
												errWrapper.throwThis('DB', 500, `Tipo de dados ${key[1]} definido no input da query não configurado no método, favor corrigir ou avise um administrador...`);
											}
										} else {
											if (key.length === 2) {
												r.input(key[0], key[1]);
											} else {
												errWrapper.throwThis('DB', 500, `Formato { ${key} } inválido para input da query, necessita de duas ou três chaves dependendo do modelo da chamada...`);
											}
										}
									});
								}
							};

							const outputCheck = () => {
								if (Object.prototype.hasOwnProperty.call(p.dados, 'output')) {
									p.dados.output.forEach(key => {
										if (key.length === 2) {
											const dataType = dataTypeCheck(key[1]);

											if (dataType.base) {
												if (Array.isArray(dataType.ext)) {
													r.output(key[0], sql[dataType.base](...dataType.ext));
												} else {
													r.output(key[0], sql[dataType.base]);
												}
											} else {
												errWrapper.throwThis('DB', 500, `Tipo de dados ${key[1]} definido no output da query não configurado no método, favor corrigir ou avise um administrador...`);
											}
										} else {
											errWrapper.throwThis('DB', 500, `Formato { ${key} } inválido para output da query, necessita de duas chaves...`);
										}
									});
								}
							};

							inputCheck();
							outputCheck();

							const isStream = dbConfig.msSqlServer.configDb.stream === true;

							switch (p.formato) {
								case 1: {
								// Query Simples
									if (!isStream) {
										return await r.query(p.dados.executar);
									}

									r.query(p.dados.executar);
									return -1;
								}
								case 2: {
								// Stored Procedure
									if (!isStream) {
										return await r.execute(p.dados.executar);
									}

									r.execute(p.dados.executar);
									return -1;
								}
								default: {
									errWrapper.throwThis('DB', 500, 'Formato não foi corretamente definido nos parâmetros JSON para execução da query, ele contempla apenas os valores numéricos: 1 (Queries locais) ou 2 (Stored Procedure)...');
								}
							}
						} else {
							errWrapper.throwThis('DB', 500, 'A propriedade executar não foi corretamente definida nos parâmetros JSON para execução da query, verifique seu código...');
						}
					} else {
						errWrapper.throwThis('DB', 500, 'O formato e/ou os dados não foram corretamente definidos nos parâmetros JSON para execução da query, verifique seu código...');
					}
				};

				sqlAction(request, params)
				.then(
					res => {
						const sqlFormattedResult = result => {
							const formattedResult = {};

							if (result.rowsAffected.length === 1 && result.recordsets.length === 1) {
								formattedResult.recordset = result.recordsets[0];
								formattedResult.rowsAffected = result.rowsAffected[0];
							} else {
								formattedResult.recordsets = result.recordsets;
								formattedResult.rowsAffected = result.rowsAffected;
							}

							// Output values, se existirem
							if (typeof result.output === 'object' && Object.keys(result.output).length) {
								formattedResult.output = result.output;
							}

							// Return value, se existir
							if (result.returnValue) {
								formattedResult.returnValue = result.returnValue;
							}

							return formattedResult;
						};

						if (res !== -1) {
							resolve(
								sqlFormattedResult(res)
							);
						} else { // Stream
							const streamingAll = [];

							request.on(
								'error',
								err => {
									failReturn(err);
								}
							);

							request.on(
								'row',
								row => {
									streamingAll.push(row);
								}
							);

							request.on(
								'done',
								done => {
									const streamSplitted = [];

									const streamSplit = (
										Array.isArray(done.rowsAffected) ? (
											done.rowsAffected
										) : (
											[streamingAll.length]
										)
									);

									let streamPick = 0;

									streamSplit.forEach(
										blockSplit => {
											const nextPick = streamPick + blockSplit;
											const blockCurrent = streamingAll.slice(streamPick, nextPick);

											streamSplitted.push(blockCurrent);
											streamPick = nextPick;
										}
									);

									done.recordsets = streamSplitted;

									resolve(
										sqlFormattedResult(done)
									);
								}
							);
						}
					}
				)
				.catch(
					err => {
						failReturn(err);
					}
				);
			} catch (err) {
				failReturn(err);
			}
		});
	},

	sqlCloseCon: (transaction, forceClose = false) => { // Commit na transacao (rollback automatico via config)
		return new Promise((resolve, reject) => {
			const failReturn = err => {
				sql.close();
				reject(err);
			};

			try {
				transaction.commit()
				.then(
					() => {
						if (dbConfig.msSqlServer.connectionType === 2 || forceClose) {
						// Conexao simples, direta, sem pool
							sql.close();
						}

						resolve();
					}
				)
				.catch(
					err => {
						failReturn(err);
					}
				);
			} catch (err) {
				failReturn(err);
			}
		});
	},

	/*
	Detalhes:
		params => Seguem o formato json: { formato: , dados: { input: , output: , executar: } }

		* Verificar arquivo de ajuda
	*/
	sqlExecuteAll: async (params, forceClose = false) => { // Inicia uma transacao, executa e commita em uma unica chamada de metodo
		const transaction = await msSqlServer.sqlOpenCon();
		const result = await msSqlServer.sqlExecute(transaction, params);

		await msSqlServer.sqlCloseCon(transaction, forceClose);

		return result;
	},

	/*
	Espera uma array de valores ou valor unico em param
		-> Limpa cada valor da array ou valor unico, validando caracteres perigosos (sanitize)
			-> Retorna String protegida ou o valor existente sem modificacao (se diferente de String)
	*/
	sanitize: param => {
		const sanitizeThis = _param => {
			if (typeof _param === 'string') {
				return _param.replace(
					/[\0\x08\x09\x1a\n\r"'\\%]/g, // eslint-disable-line no-control-regex
					char => {
						switch (char) {
							case '\0':
								return '\\0';
							case '\x08':
								return '\\b';
							case '\x09':
								return '\\t';
							case '\x1a':
								return '\\z';
							case '\n':
								return '\\n';
							case '\r':
								return '\\r';
							case '"':
								return '""';
							case '\'':
								return '\'\'';
							case '\\':
							case '%':
								return `\\${char}`;
							default:
								return char;
						}
					}
				);
			}

			if (!Array.isArray(_param)) {
				return _param;
			}

			return (
				_param.map(
					value => {
						return sanitizeThis(value);
					}
				)
			);
		};

		return sanitizeThis(param);
	}
};
// -------------------------------------------------------------------------

module.exports = {
	msSqlServer
};
