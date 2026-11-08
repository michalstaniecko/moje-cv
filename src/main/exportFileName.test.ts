import { describe, expect, test } from 'vitest'
import type { CvLanguage } from '../renderer/src/domain/schema'
import { exportFileName, transliterate } from './exportFileName'

const named = (fullName: string, language: CvLanguage = 'en', cvName = '') =>
  exportFileName({ fullName, cvName, language, extension: 'pdf' })

describe('exportFileName', () => {
  test.each<[string, CvLanguage, string]>([
    ['Anna Przykładowa', 'pl', 'CV_Anna_Przykladowa.pdf'],
    ['Ewa Nowak-Żelazna', 'pl', 'CV_Ewa_Nowak-Zelazna.pdf'],
    ['Анна Образцова', 'ru', 'CV_Anna_Obraztsova.pdf'],
    ['Олена Зразкова', 'uk', 'CV_Olena_Zrazkova.pdf'],
    ['Nguyễn Thu Hà', 'vi', 'CV_Nguyen_Thu_Ha.pdf'],
    ['Đặng', 'vi', 'CV_Dang.pdf'],
    ['Ayşe Örnek', 'tr', 'CV_Ayse_Ornek.pdf'],
    ['Işıl Yıldız', 'tr', 'CV_Isil_Yildiz.pdf'],
    ['Jürgen Groß', 'de', 'CV_Jurgen_Gross.pdf'],
    ['Ștefan Țurcanu', 'ro', 'CV_Stefan_Turcanu.pdf'],
    ['Åsa Bjørn Ærø', 'sv', 'CV_Asa_Bjorn_Aero.pdf'],
    ['Řehoř', 'cs', 'CV_Rehor.pdf']
  ])('%s (%s) → %s', (fullName, language, expected) => {
    expect(named(fullName, language)).toBe(expected)
  })

  test('falls back to the CV name, without the word CV', () => {
    expect(named('', 'en', 'CV – Talent Partners')).toBe('CV_Talent_Partners.pdf')
    expect(named('王芳', 'en', 'cv Junior')).toBe('CV_Junior.pdf')
  })

  test('falls back to CV.pdf when neither name gives a Latin word', () => {
    expect(named('', 'en', '')).toBe('CV.pdf')
    expect(named('王芳', 'en', '简历')).toBe('CV.pdf')
    expect(named('', 'en', 'CV')).toBe('CV.pdf')
  })

  test('limits the part before .pdf to 100 characters', () => {
    const name = named('Bartholomew '.repeat(20))
    expect(name).toMatch(/^CV_Bartholomew_/)
    expect(name).toHaveLength(100 + '.pdf'.length)
  })
})

describe('exportFileName for DOCX', () => {
  const docx = (fullName: string, language: CvLanguage = 'en', cvName = '') =>
    exportFileName({ fullName, cvName, language, extension: 'docx' })

  test.each<[string, CvLanguage, string]>([
    ['Anna Przykładowa', 'pl', 'CV_Anna_Przykladowa.docx'],
    ['Анна Образцова', 'ru', 'CV_Anna_Obraztsova.docx'],
    ['Олена Зразкова', 'uk', 'CV_Olena_Zrazkova.docx'],
    ['Nguyễn Thu Hà', 'vi', 'CV_Nguyen_Thu_Ha.docx']
  ])('%s (%s) → %s', (fullName, language, expected) => {
    expect(docx(fullName, language)).toBe(expected)
  })

  test('falls back to the CV name and then to CV.docx', () => {
    expect(docx('', 'en', 'CV – Talent Partners')).toBe('CV_Talent_Partners.docx')
    expect(docx('王芳', 'en', '简历')).toBe('CV.docx')
  })

  test('limits the part before .docx to 100 characters', () => {
    const name = docx('Bartholomew '.repeat(20))
    expect(name).toMatch(/^CV_Bartholomew_/)
    expect(name).toHaveLength(100 + '.docx'.length)
  })
})

describe('transliterate', () => {
  test('follows Ukrainian rules for a Ukrainian CV and Russian rules otherwise', () => {
    expect(transliterate('Ганна', 'uk')).toBe('Hanna')
    expect(transliterate('Ганна', 'ru')).toBe('Ganna')
    expect(transliterate('Їжак Єва Ґанок Іван Марʼяна', 'uk')).toBe('Yizhak Yeva Ganok Ivan Maryana')
    expect(transliterate('Подъезд Ёлка Щука Хмель Йод Цой Эра Мышь Жанна', 'ru')).toBe(
      'Podezd Elka Shchuka Khmel Yod Tsoy Era Mysh Zhanna'
    )
  })

  test('maps letters that NFD does not decompose', () => {
    expect(transliterate('łŁđĐıßẞæÆøØœŒþÞð', 'en')).toBe('lLdDissSSaeAeoOoeOethThd')
  })
})
