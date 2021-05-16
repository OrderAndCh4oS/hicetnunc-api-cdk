#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {HicEtNuncApiStack} from "../lib/api-stack";
import {config} from 'dotenv'

config();

const nautilusApiKey = process.env.NAUTILUS_API_KEY;

if (!nautilusApiKey) throw new Error('Missing NAUTILUS_API_KEY environment variable')

const app = new cdk.App();
new HicEtNuncApiStack(app, 'HicEtNuncApiStack', {nautilusApiKey});
