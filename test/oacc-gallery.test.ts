import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import {OaccGalleryStack} from "../lib/main-stack";

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new OaccGalleryStack(app, 'MyTestStack', {}, {
        certificateArn: "",
        domainName: "",
        name: ""
    });
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
