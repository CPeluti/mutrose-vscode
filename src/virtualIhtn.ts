import * as vscode from 'vscode';
import {readFileSync} from 'fs';
import { Ihtn } from './ihtn';
export const virtualIhtnProvider = new (class implements vscode.TextDocumentContentProvider {
	provideTextDocumentContent(uri: vscode.Uri): string {
	// invoke cowsay, use uri-path as text
			console.log(uri.path);
			const file = readFileSync(uri.path);
			try{
				const ihtn = new Ihtn(JSON.parse(file.toString()));
				return ihtn.convert();
			} catch (e) {
				console.log(e);
			}
	}
  })();