'use strict';

// -------------------------------------------------------------------------
// Modulos de inicializacao
const sql = require('mssql');

// Arquivo config
const dbConfig = require('./db-config');
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
/*
Dispara um erro customizado (metodo privado)
*/
const _throwThis = (name, code, message) => {
	const e = new Error();

	e.name = name;
	e.code = code;
	e.message = message;

	throw e;
};

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

							const inputCheck = (r, p) => {
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
												_throwThis.throwThis('DB', 500, `${key[1]} data type defined (query input) was not found in method, please correct or notify an administrator...`);
											}
										} else {
											if (key.length === 2) {
												r.input(key[0], key[1]);
											} else {
												_throwThis.throwThis('DB', 500, `Format { ${key} } is invalid (query input), requires two or three keys depending on the calling model...`);
											}
										}
									});
								}
							};

							const outputCheck = (r, p) => {
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
												_throwThis.throwThis('DB', 500, `${key[1]} data type defined (query output) was not found in method, please correct or notify an administrator...`);
											}
										} else {
											_throwThis.throwThis('DB', 500, `Format { ${key} } is invalid (query output), requires two keys...`);
										}
									});
								}
							};

							inputCheck(r, p);
							outputCheck(r, p);

							switch (p.formato) {
								case 1: {
								// Query Simples
									return await r.query(p.dados.executar);
								}
								case 2: {
								// Stored Procedure
									return await r.execute(p.dados.executar);
								}
								default: {
									_throwThis.throwThis('DB', 500, 'Format not correctly defined in the JSON parameters, it only works with the following values: 1 (local queries) or 2 (stored procedure)...');
								}
							}
						} else {
							_throwThis.throwThis('DB', 500, 'Execute not correctly defined in the JSON parameters, check your code...');
						}
					} else {
						_throwThis.throwThis('DB', 500, 'Format and/or data not correctly defined in the JSON parameters, check your code...');
					}
				};

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

				sqlAction(request, params)
				.then(
					res => {
						resolve(
							sqlFormattedResult(res)
						);
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
				const sqlClose = p => {
					p.close();
				};

				transaction.commit()
				.then(
					() => {
						if (dbConfig.msSqlServer.connectionType === 2 || forceClose) {
						// Conexao simples, direta, sem pool
							sqlClose(sql);
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
	}
};
// -------------------------------------------------------------------------

module.exports = {
	msSqlServer
};
