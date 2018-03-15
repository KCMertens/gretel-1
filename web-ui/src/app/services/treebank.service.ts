import {Injectable} from '@angular/core';
import {Observable} from "rxjs/Observable";
import * as Rx from "rxjs/Rx"
import {Treebank, TreebankInfo} from "../treebank";
import {HttpClient} from "@angular/common/http";


@Injectable()
export class TreebankService {

  constructor(private http: HttpClient) {
  }

  treebanks: Treebank[] = [
    {
      id: "1",
      title: "test_treebank",
    },
    {
      id: "2",
      title: "test_treebank2",
    }
  ];

  treebanksInfo: TreebankInfo[] = [
    {
      slug: "test_treebank",
      name: "first name",
      nrSentences: 2,
      nrWords: 200,
    },
    {
      slug: "test_treebank",
      name: "second name",
      nrSentences: 100,
      nrWords: 101,
    },
    {
      slug: "test_treebank",
      name: "third name",
      nrSentences: 3,
      nrWords: 8,
    },
    {
      slug: "test_treebank2",
      name: "first name",
      nrSentences: 20,
      nrWords: 21,
    },
  ];


  getTreebanks(): Observable<Treebank> {
    //TODO: make a link service
    return this.http.get("http://localhost:8080/gretel-upload/index.php/api/treebank");

  }

  getTreebankInfo(treebank: Treebank) {
    return this.http.get(`http://localhost:8080/gretel-upload/index.php/api/treebank/show/${treebank.title}`)
    return Rx.Observable.from(
      this.treebanksInfo.filter((info: TreebankInfo) => info.slug == treebank.title)
    );
  }
}
