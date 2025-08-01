import { describe, it, expect } from 'vitest';
import {
  isRemoteUrl,
  isFilePath,
  isInline,
  detectSourceType,
} from '../../src/utils/source-helper.js';

describe('SourceHelper', () => {
  describe('isRemoteUrl', () => {
    it('should detect valid HTTP URLs', () => {
      expect(isRemoteUrl('http://example.com')).toBe(true);
      expect(isRemoteUrl('http://www.example.com')).toBe(true);
      expect(isRemoteUrl('http://subdomain.example.com')).toBe(true);
      expect(isRemoteUrl('http://example.com/path')).toBe(true);
      expect(isRemoteUrl('http://example.com/path/to/file.txt')).toBe(true);
      expect(isRemoteUrl('http://example.com:8080')).toBe(true);
      expect(isRemoteUrl('http://example.com:8080/path')).toBe(true);
      expect(isRemoteUrl('http://localhost')).toBe(true);
      expect(isRemoteUrl('http://localhost:3000')).toBe(true);
      expect(isRemoteUrl('http://localhost:3000/api/data')).toBe(true);
    });

    it('should detect valid HTTPS URLs', () => {
      expect(isRemoteUrl('https://example.com')).toBe(true);
      expect(isRemoteUrl('https://www.example.com')).toBe(true);
      expect(isRemoteUrl('https://api.example.com/v1/data')).toBe(true);
      expect(isRemoteUrl('https://example.com:443/secure')).toBe(true);
      expect(isRemoteUrl('https://localhost:8443')).toBe(true);
    });

    it('should handle URLs with query parameters and fragments', () => {
      expect(isRemoteUrl('https://example.com/path?param=value')).toBe(true);
      expect(isRemoteUrl('https://example.com/path?param1=value1&param2=value2')).toBe(true);
      expect(isRemoteUrl('https://example.com/path#fragment')).toBe(true);
      expect(isRemoteUrl('https://example.com/path?param=value#fragment')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isRemoteUrl('ftp://example.com')).toBe(false);
      expect(isRemoteUrl('file://path/to/file')).toBe(false);
      expect(isRemoteUrl('example.com')).toBe(false);
      expect(isRemoteUrl('www.example.com')).toBe(false);
      expect(isRemoteUrl('http://')).toBe(false);
      expect(isRemoteUrl('https://')).toBe(false);
      expect(isRemoteUrl('http://.')).toBe(false);
      expect(isRemoteUrl('https://.')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isRemoteUrl('')).toBe(false);
      expect(isRemoteUrl('   ')).toBe(false);
      expect(isRemoteUrl(null as any)).toBe(false);
      expect(isRemoteUrl(undefined as any)).toBe(false);
      expect(isRemoteUrl(123 as any)).toBe(false);
    });

    it('should handle URLs with whitespace', () => {
      expect(isRemoteUrl('  https://example.com  ')).toBe(true);
      expect(isRemoteUrl('\nhttps://example.com\n')).toBe(true);
      expect(isRemoteUrl('\thttps://example.com\t')).toBe(true);
    });
  });

  describe('isFilePath', () => {
    it('should detect absolute Unix paths', () => {
      expect(isFilePath('/path/to/file')).toBe(true);
      expect(isFilePath('/home/user/document.txt')).toBe(true);
      expect(isFilePath('/var/log/app.log')).toBe(true);
      expect(isFilePath('/etc/config.conf')).toBe(true);
    });

    it('should detect absolute Windows paths', () => {
      expect(isFilePath('C:\\path\\to\\file')).toBe(true);
      expect(isFilePath('D:\\Users\\user\\document.txt')).toBe(true);
      expect(isFilePath('C:/path/to/file')).toBe(true);
      expect(isFilePath('D:/Users/user/document.txt')).toBe(true);
    });

    it('should detect relative paths', () => {
      expect(isFilePath('./file.txt')).toBe(true);
      expect(isFilePath('./path/to/file')).toBe(true);
      expect(isFilePath('../file.txt')).toBe(true);
      expect(isFilePath('../path/to/file')).toBe(true);
      expect(isFilePath('../../config/settings.json')).toBe(true);
    });

    it('should detect home directory paths', () => {
      expect(isFilePath('~/file.txt')).toBe(true);
      expect(isFilePath('~/Documents/file.txt')).toBe(true);
      expect(isFilePath('~/path/to/config.yaml')).toBe(true);
    });

    it('should detect files with common text extensions', () => {
      expect(isFilePath('config.txt')).toBe(true);
      expect(isFilePath('README.md')).toBe(true);
      expect(isFilePath('document.markdown')).toBe(true);
      expect(isFilePath('data.json')).toBe(true);
      expect(isFilePath('settings.yaml')).toBe(true);
      expect(isFilePath('app.conf')).toBe(true);
      expect(isFilePath('error.log')).toBe(true);
      expect(isFilePath('package.json')).toBe(true);
    });

    it('should detect paths with directory separators', () => {
      expect(isFilePath('src/components')).toBe(true);
      expect(isFilePath('lib\\utils')).toBe(true);
      expect(isFilePath('assets/images/logo')).toBe(true);
      expect(isFilePath('folder/subfolder')).toBe(true);
      expect(isFilePath('dir\\subdir')).toBe(true);
    });

    it('should reject URLs', () => {
      expect(isFilePath('https://example.com')).toBe(false);
      expect(isFilePath('http://localhost:3000')).toBe(false);
      expect(isFilePath('ftp://server.com/file')).toBe(false);
    });

    it('should reject simple words without path indicators', () => {
      expect(isFilePath('hello')).toBe(false);
      expect(isFilePath('world123')).toBe(false);
      expect(isFilePath('simpletext')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isFilePath('')).toBe(false);
      expect(isFilePath('   ')).toBe(false);
      expect(isFilePath(null as any)).toBe(false);
      expect(isFilePath(undefined as any)).toBe(false);
      expect(isFilePath(123 as any)).toBe(false);
    });

    it('should handle paths with whitespace', () => {
      expect(isFilePath('  ./file.txt  ')).toBe(true);
      expect(isFilePath('\n/path/to/file\n')).toBe(true);
      expect(isFilePath('\t~/config.yaml\t')).toBe(true);
    });
  });

  describe('isInline', () => {
    it('should detect inline content', () => {
      expect(isInline('Hello world')).toBe(true);
      expect(isInline('This is a simple prompt')).toBe(true);
      expect(isInline('You are a helpful assistant')).toBe(true);
      expect(isInline('Multi-line\ncontent\nhere')).toBe(true);
      expect(isInline('Content with numbers 123 and symbols !@#')).toBe(true);
    });

    it('should reject URLs', () => {
      expect(isInline('https://example.com')).toBe(false);
      expect(isInline('http://localhost:3000')).toBe(false);
    });

    it('should reject file paths', () => {
      expect(isInline('./config.txt')).toBe(false);
      expect(isInline('/path/to/file')).toBe(false);
      expect(isInline('~/document.md')).toBe(false);
      expect(isInline('settings.json')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isInline('')).toBe(false);
      expect(isInline('   ')).toBe(false);
      expect(isInline(null as any)).toBe(false);
      expect(isInline(undefined as any)).toBe(false);
      expect(isInline(123 as any)).toBe(false);
    });

    it('should handle borderline cases correctly', () => {
      // These should be inline content, not file paths
      expect(isInline('word1 word2')).toBe(true); // spaces make it clearly inline
      expect(isInline('sentence with punctuation.')).toBe(true);
      expect(isInline('question?')).toBe(true);
      expect(isInline('exclamation!')).toBe(true);
    });
  });

  describe('detectSourceType', () => {
    it('should detect remote URLs', () => {
      expect(detectSourceType('https://example.com')).toBe('remote-url');
      expect(detectSourceType('http://localhost:3000')).toBe('remote-url');
    });

    it('should detect file paths', () => {
      expect(detectSourceType('./config.txt')).toBe('file-path');
      expect(detectSourceType('/path/to/file')).toBe('file-path');
      expect(detectSourceType('~/document.md')).toBe('file-path');
      expect(detectSourceType('settings.json')).toBe('file-path');
    });

    it('should detect inline content', () => {
      expect(detectSourceType('Hello world')).toBe('inline');
      expect(detectSourceType('You are a helpful assistant')).toBe('inline');
      expect(detectSourceType('Multi-line\ncontent')).toBe('inline');
    });

    it('should handle edge cases', () => {
      expect(detectSourceType('')).toBe('inline');
      expect(detectSourceType('   ')).toBe('inline');
    });

    it('should prioritize detection correctly', () => {
      // URLs should be detected first
      expect(detectSourceType('https://example.com/path.txt')).toBe('remote-url');

      // File paths should be detected second
      expect(detectSourceType('./prompt.txt')).toBe('file-path');

      // Everything else should be inline
      expect(detectSourceType('simple text')).toBe('inline');
    });
  });
});
